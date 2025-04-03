import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  createUser,
  connectDB,
  closeDB,
  verifyUser,
  getEmail,
  createTeamAndAddUser,
  getTeams,
  sendInvite,
  handleInvite,
  getAllNotifications,
  validateInviter,
  validateUserInTeam,
  getAllParticipantsInTeam,
  viewMessagesInTeam,
  sendMessageInTeam,
} from "./db/db.js";
import { addSession, verifySession } from "./db/redis.js";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { text } from "stream/consumers";
const app = express();
const server = createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Startup Functions
await connectDB();

// Middlewares
const sessionMiddleware = async (req, res, next) => {
  console.log("verifying session");
  const userCookie = req.cookies.auth_token;

  if (!userCookie) {
    console.log("Session Failure (No Cookie)");

    res.clearCookie("auth_token");
    return res.status(401).json({ message: "Unauthorized" });
  }

  const result = await verifySession(userCookie);

  if (result.success) {
    console.log("Session Verified");
    req.userId = result.userId;
    next();
  } else {
    console.log("Session Failure (Invalid Cookie)");

    res.clearCookie("auth_token");
    return res.status(401).json({ message: "Unauthorized" });
  }
};

app.use(express.json());
app.use(cookieParser());
app.use("/api/protected", sessionMiddleware);
// Enable CORS for all requests
// SERVING HTML FILES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.resolve(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

app.get("/:folder", (req, res, next) => {
  if (req.params.folder === "api") return next(); // Pass to next middleware

  const folderName = req.params.folder;

  const filePath = path.resolve(
    __dirname,
    "..",
    "public",
    folderName,
    "index.html"
  );

  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(err.status || 500).send("Page not found");
    }
  });
});

app.get("/:folder/*", (req, res, next) => {
  if (req.params.folder === "api") return next(); // Pass to next middleware

  const folderName = req.params.folder;
  const sublinkPath = req.params[0]; // '0' is the wildcard parameter
  const filePath = path.resolve(
    __dirname,
    "..",
    "public",
    folderName,
    sublinkPath,
    "index.html"
  );

  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(err.status || 500).send("Page not found");
    }
  });
});

// SOCKETS
const teamUsers = new Map(); // Maps teamId -> Set of socket IDs
// teamId: {1, 2, 3, 4}
const socketToTeams = new Map(); // Maps socketId -> Set of teamIds for faster disconnection
// socketId: {team1, team2}

io.on("connection", (socket) => {
  console.log("A user connected");
  const cookies = socket.request.headers.cookie || "";
  const userCookie = cookies
    .split("; ")
    .find((row) => row.startsWith("auth_token="))
    ?.split("=")[1];
  console.log(`Cookies ${userCookie}`);

  socket.on("joinTeam", async ({ teamId }) => {
    if (!userCookie) {
      console.log("Session Failure (No Cookie)");
      socket.emit("error", { message: "Authentication required" });
      return;
    }

    try {
      const result = await verifySession(userCookie);
      const uid = result.userId;

      // Pass both userId and teamId to validation
      const response = await validateUserInTeam(uid, teamId);

      if (response) {
        console.log(`User ${uid} joining team ${teamId}`);

        // Track team membership
        if (!teamUsers.has(teamId)) {
          teamUsers.set(teamId, new Set());
        }
        teamUsers.get(teamId).add(socket.id);

        // Track socket's teams for easier cleanup
        if (!socketToTeams.has(socket.id)) {
          socketToTeams.set(socket.id, new Set());
        }
        socketToTeams.get(socket.id).add(teamId);

        socket.join(teamId);
        socket.emit("joinedTeam", { teamId });
        console.log(`User added to team ${teamId}`);
      } else {
        socket.emit("error", { message: "Not authorized to join this team" });
      }
    } catch (error) {
      console.error("Error in joinTeam:", error);
      socket.emit("error", { message: "Server error while joining team" });
    }
  });

  socket.on("disconnect", () => {
    // More efficient disconnect handling
    if (socketToTeams.has(socket.id)) {
      for (const teamId of socketToTeams.get(socket.id)) {
        const users = teamUsers.get(teamId);
        if (users) {
          users.delete(socket.id);
          if (users.size === 0) {
            teamUsers.delete(teamId);
          }
        }
      }
      socketToTeams.delete(socket.id);
    }
    console.log("User disconnected");
  });
});

app.post("/api/register", async (req, res) => {
  // Store session -> return to home
  try {
    console.log(req.body);
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const id = await createUser(email, password);
    const redisKey = await addSession(id);
    res.cookie("auth_token", redisKey, {
      httpOnly: true,
      secure: false,
      maxAge: 3600000,
      sameSite: "strict",
    });
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/login", async (req, res) => {
  // Verify
  // Send Cookie
  try {
    const email = req.body.email;
    const password = req.body.password;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const result = await verifyUser(email, password);
    if (!result.success) {
      return res.status(401).json({ error: result.message });
    }

    // TO-DO
    // Store session
    // Send Cookie
    const id = result.userId;
    const redisKey = await addSession(id);
    res.cookie("auth_token", redisKey, {
      httpOnly: true,
      secure: false,
      maxAge: 3600000,
      sameSite: "strict",
    });
    res.status(200).json({ message: "Successful Login" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// /api/*
app.get("/api", (req, res) => {
  res.send("Yessir");
});

// Protected Routes /api/protected/*

app.get("/api/protected/data", async (req, res) => {
  console.log("ENDPOINT HIT");
  res.json({ message: "This is protected information", id: `${req.userId}` });
});

app.get("/api/protected/email", async (req, res) => {
  const id = req.userId;
  try {
    const em = await getEmail(id);
    res.json({ email: em });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "something went wrong" });
  }
});

// Teams
// Create Team
app.post("/api/protected/create-team", async (req, res) => {
  const id = req.userId;
  const teamName = req.body.teamName;
  try {
    const teamId = await createTeamAndAddUser(teamName, id);
    res.status(201).json({ message: "Team Successfully Created" });
    console.log(`Team created with id ${teamId}`);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
    console.error(error);
  }
});

app.get("/api/protected/get-teams", async (req, res) => {
  const id = req.userId;
  try {
    const result = await getTeams(id);
    res.status(201).json({ success: true, teams: result });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
    console.error(error);
  }
});
app.post("/api/protected/send-invite", async (req, res) => {
  const id = req.userId;
  const { invitee_email, teamId } = req.body;

  // Basic input validation
  if (!invitee_email || !teamId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // VERIFY IF THIS GUY CAN EVEN INVITE PEOPLE TO THIS TEAM ID
    const canInvite = await validateInviter(id, teamId);
    if (!canInvite) {
      return res.status(403).json({
        message: "You are not authorized to send invitations for this team",
      });
    }

    // Send the invitation
    const result = await sendInvite(id, invitee_email, teamId);

    // Return success response
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res
        .status(400)
        .json({ message: result.message || "Failed to send invitation" });
    }
  } catch (error) {
    console.error("Error sending invitation:", error);
    return res
      .status(500)
      .json({ message: error.message || "Something went wrong" });
  }
});

app.get("/api/protected/get-notifications", async (req, res) => {
  const id = req.userId;
  try {
    const result = await getAllNotifications(id);
    return res.status(200).json({ notifications: result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Something went wrong getting notifications" });
  }
});

app.post("/api/protected/handle-invite", async (req, res) => {
  try {
    const userId = req.userId;
    const { invite_id, action } = req.body;

    // Basic validation
    if (!invite_id || !action || !["accept", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid request parameters" });
    }

    const result = await handleInvite(invite_id, userId, action);
    if (result.success) {
      return res
        .status(200)
        .json({ message: `Successfully ${action}ed invitation` });
    } else {
      return res
        .status(400)
        .json({ message: result.message || `Failed to ${action} invitation` });
    }
  } catch (error) {
    console.error("Error handling invitation:", error);
    return res
      .status(500)
      .json({ message: error.message || "Something went wrong" });
  }
});
// Starting Up

// Messages To Do
/* 
  Make sure that
  Make api to app.get("/api/protected/message")
  If user not in field, return unauthorized, and redirect back to home page

*/

app.post("/api/protected/get-participants-in-team", async (req, res) => {
  const userId = req.userId;
  const teamId = req.body.teamId;
  const val = await validateUserInTeam(userId, teamId);
  if (val) {
    try {
      const result = await getAllParticipantsInTeam(teamId);
      return res.status(200).json({ participants: result });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  } else {
    return res.status(401).json({ message: "You are unauthorized" });
  }
});
app.get("/api/protected/view-messages-in-team", async (req, res) => {
  const userId = req.userId;
  const teamId = req.body.teamId;
  const val = await validateUserInTeam(userId, teamId);
  if (val) {
    try {
      const result = await viewMessagesInTeam(teamId);
      return res.status(200).json({ messages: result });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  } else {
    return res.status(401).json({ message: "You are unauthorized" });
  }
});

app.post("/api/protected/send-message-in-team", async (req, res) => {
  const userId = req.userId;
  const teamId = req.body.teamId;
  const content = req.body.content;

  try {
    const val = await validateUserInTeam(userId, teamId);
    if (!val) {
      return res.status(401).json({ message: "You are unauthorized" });
    }

    const result = await sendMessageInTeam(userId, teamId, content);
    if (!result.success) {
      return res.status(400).json({ message: "Failed to send message" });
    }

    const email = await getEmail(userId);

    // Even if no sockets are connected, message should be considered sent
    // as it's stored in the database
    io.to(teamId).emit("newMessage", {
      sender: email,
      text: content,
      date: result.created_at,
    });
    const userEmail = await getEmail(userId);
    return res.status(200).json({
      message: "Message sent successfully",
      date: result.created_at,
      sender: userEmail,
      text: content,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

app.post("/api/protected/view-messages-in-team", async (req, res) => {
  const userId = req.userId;
  const teamId = req.body.teamId;
  try {
    const validate = await validateUserInTeam(userId, teamId);
    if (validate) {
      const rows = await viewMessagesInTeam(teamId);
      return res.status(200).json({ messages: rows });
    } else {
      return res.status(400).json({ message: "Unauthorized" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something Went Wrong" });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// General TO DO
//  websocket messages
//  WebRTC video meetings
// Exit Functions
process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});
