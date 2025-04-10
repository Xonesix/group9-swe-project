import express from "express";
import {
  getEmail,
  createTeamAndAddUser,
  getTeams,
  validateUserInTeam,
  getAllParticipantsInTeam,
  viewMessagesInTeam,
  sendMessageInTeam,
  deleteUserFromTeam,
} from "../db/db.js";

export default function (io) {
  const router = express.Router();
  router.post("/api/protected/get-participants-in-team", async (req, res) => {
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
  router.get("/api/protected/view-messages-in-team", async (req, res) => {
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

  router.post("/api/protected/send-message-in-team", async (req, res) => {
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
      //   This emits the message so when message is confirmed sent, it broadcasts msg to
      //  update all connected clients display to show the new message
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

  router.post("/api/protected/view-messages-in-team", async (req, res) => {
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

  router.delete("/api/protected/leave-team", async (req, res) => {
    const userId = req.userId;
    const teamId = req.body.teamId;
    try {
      const validate = await validateUserInTeam(userId, teamId);
      if (validate) {
        const result = await deleteUserFromTeam(userId, teamId);
        if (result.success)
          return res.status(200).json({ message: "Left Team Successfully" });
        else return res.status(400).json({ message: "Error leaving team" });
      }
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });
  router.post("/api/protected/create-team", async (req, res) => {
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

  router.get("/api/protected/get-teams", async (req, res) => {
    const id = req.userId;
    try {
      const result = await getTeams(id);
      res.status(201).json({ success: true, teams: result });
    } catch (error) {
      res.status(500).json({ message: "Something went wrong" });
      console.error(error);
    }
  });
  return router;
}
