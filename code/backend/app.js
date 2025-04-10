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
  validateUserInTeam,
} from "./db/db.js";
import { addSession, verifySession } from "./db/redis.js";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { text } from "stream/consumers";
import teamRoutes from "./routes/teams.js";
import notificationRoutes from "./routes/notification_routes.js";
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
  res.redirect("/login");
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

// SOCKETS (do not separate)
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
  // console.log(`Cookies ${userCookie}`);

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

// base endpoints

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

// routes are in backend/routes
app.use("/", notificationRoutes(io));
app.use("/", teamRoutes(io));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});
