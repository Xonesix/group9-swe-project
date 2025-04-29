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
  updateUsername,
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
//  THis is just authentication logic, runs before every /api/protected route
// stores session id in cookie which session id maps to userId in redis.
// If session exists in redis, continue otherwise do not continue with protected routes
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

// for ejs support
app.set("view engine", "ejs");

// These are the routes that serve index.html files.
app.get("/:folder", (req, res, next) => {
  /* Basically :folder is just a wildcard it can be any thing e.g. if i
  hit the endpoint of /gibberish then 'gibberish' is now the req.params.folder
  if this starts with api push it on cause we don't need that
  but if it doesn't start with /api/ then we assume it's referring to an html file e.g (/dashboard, /login)
  it takes that and sends the proper html file (in the folder/index.html) route to the user
  so when you type localhost:3000/dashboard it will properly serve /frontend/dashboard/index.html */
  if (req.params.folder === "api") return next(); // Pass to next middleware

  const folderName = req.params.folder;
  // This is the path to find the html files
  const filePath = path.resolve(
    // dirname is current directory
    // it looks for html in __dirname/../public/folderName/index.html to see which file to serve
    __dirname,
    "..",
    "public",
    folderName,
    "index.html"
  );
  //  if can't find it then return [page not found] there should be a /404/index.html page but im a lazy bum so it just send 500 error code
  res.sendFile(filePath, (err) => {
    if (err) {
      // also res is just short for response (this is the response of the server)
      //  in this case it essentially sends a http 500 code (meaning internal server error) (it should be 404 probably so if you're reading this... change it to 404)
      res.status(err.status || 500)/*.send("Page not found")*/;
      res.render("error", {
        title: "404 - Page Not Found",
        message: "The page you are looking for does not exist.",
      });
    }
  });
});

// This just does the samething except it works for any internal routes
// so /public/folderName/xyz/index.html should work as well and serve it up though not tested yet
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
/* These basically store the rooms for when a user connects to a team chat. When connecting
the user connects to a live server connection to enable those instant message popping up live on
users who are active in that team. When a person clicks on the chat button they join a webSocket server 
(ifykyk) and join a room specific to that team so when they send a message it only goes to the people in
that team. If we didn't have web sockets, to get live messages we would either have to poll database 
within a timeframe (like every 2s [inefficient]) or just forego live messaging
Sockets being a live server meaning users can communicate with each other real time
If you want more explnation of the code it's in the io.on() function
 */

// socketId: {team1, team2}
/* io this is an external library that simplifies web sockets for us working with raw sockets is tedious
and this allows us tomake rooms easier
think of io as the socket route handler.
io.on('connection') means what the socket is going to do when a user joins the web socket 
NOTE: if you're a smart cookie you will have noticed that chat/index.html contains a cdn file that actually
contains the entire io library so we don't have to work with raw webSockets on the frontend either
That's why /public/assets/js/chat_sockets.js seems a bit abstract and doesn't use vanillaJS apis
if you want to learn more about this library check out https://socket.io/ */

const teamUsers = new Map(); // Maps teamId -> Set of socket IDs
// teamId: {1, 2, 3, 4}
const socketToTeams = new Map(); // Maps socketId -> Set of teamIds for faster disconnection
io.on("connection", (socket) => {
  console.log("A user connected");
  // As soon as a user connects get the session cookie they have
  const cookies = socket.request.headers.cookie || "";
  const userCookie = cookies
    .split("; ")
    .find((row) => row.startsWith("auth_token="))
    ?.split("=")[1];
  // console.log(`Cookies ${userCookie}`);
  //  When the user emits join team (you can see this in chat_sockets.js on the frontend) perform this logic
  socket.on("joinTeam", async ({ teamId }) => {
    if (!userCookie) {
      console.log("Session Failure (No Cookie)");
      socket.emit("error", { message: "Authentication required" });
      return;
    }

    try {
      /* This make sure the user belongs to the team
      If not then don't let them join otherwise they join the teamId room */
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

/**
 * I have not done extensive testing on this yet but it should work
 * I also have basically no backend experience so hopefully this is good
 * -Hudson Green
 **/
// This seems like solid code good work - Arjun J.
app.post("/api/logout", async (req, res) => {
  // Clear session cookie
  try {
    // This is the cookie that was set when the user logged in
    const userCookie = req.cookies.auth_token;

    // Ensure we are not already logged out
    if (!userCookie) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Clear the session on client side
    res.clearCookie("auth_token");
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/protected/email", async (req, res) => {
  const id = req.userId;
  try {
    const em = await getEmail(id);
    res.json({ email: em.email, username: em.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "something went wrong" });
  }
});

app.post("/api/protected/updateUsername", async (req, res) => {
  try{
    const id = req.userId;
    const username = req.body.username;
    const usernameSuccess = await updateUsername(id, username);
    console.log(req.body);
    if(usernameSuccess == true){
      res.status(200).json({"message": "username updated"});
    }
  } catch (error){
    console.log("error with updateUsername request: ", error);
    res.status(500).json({"message": "error updating username"});
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
