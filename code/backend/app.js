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
} from "./db/db.js";
import { addSession, verifySession } from "./db/redis.js";
import cookieParser from "cookie-parser";
const app = express();
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
// TO-DO -> Register, Login, Session Middle Ware
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Exit Functions
process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});

// TO DO
//  websocket messages
//  WebRTC video meetings
