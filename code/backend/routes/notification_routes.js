import express from "express";
import {
  sendInvite,
  handleInvite,
  getAllNotifications,
  validateInviter,
} from "../db/db.js";
export default function (io) {
  const router = express.Router();
  router.post("/api/protected/send-invite", async (req, res) => {
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

  router.get("/api/protected/get-notifications", async (req, res) => {
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

  router.post("/api/protected/handle-invite", async (req, res) => {
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
        return res.status(400).json({
          message: result.message || `Failed to ${action} invitation`,
        });
      }
    } catch (error) {
      console.error("Error handling invitation:", error);
      return res
        .status(500)
        .json({ message: error.message || "Something went wrong" });
    }
  });
  return router;
}
