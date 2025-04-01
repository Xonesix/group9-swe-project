import pg from "pg";
import dotenv from "dotenv";
import { query } from "express";
import { hashPassword, verifyPassword } from "../utilities/security.js";
dotenv.config();

const { Client } = pg;

let client;

export async function connectDB() {
  if (!client) {
    console.log("Connnecting to DB");
    client = new Client({
      connectionString: process.env.POSTGRES_CONNECTION_STRING,
    });
    await client.connect();
  }
}

export async function closeDB() {
  if (client) {
    await client.end();
    console.log("Database connection closed.");
    client = null;
  }
}

export async function createUser(email, password) {
  if (!client) await connectDB();
  const query = `
  INSERT INTO users (email, password)
  VALUES ($1, $2) RETURNING *
  `;

  const hash = await hashPassword(password);

  const values = [email, hash];
  try {
    const res = await client.query(query, values);
    return res.rows[0].id;
  } catch (error) {
    console.error(error);
    throw Error(`Some Error ${error}`);
  }
}
export async function verifyUser(email, password) {
  if (!client) await connectDB();

  const query = `SELECT id, email, password FROM users WHERE $1 = email`;
  const values = [email];

  try {
    const res = await client.query(query, values);

    if (res.rows.length === 0) {
      return { success: false, message: "User Not Found", code: 404 };
    }

    const user = res.rows[0];

    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return { success: false, message: "Invalid Password", code: 400 };
    }
    return {
      success: true,
      userId: user.id,
      message: "User Verified",
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return { success: false, message: "database error", code: 500 };
  }
}

export async function createTeamAndAddUser(teamName, userId) {
  if (!client) await connectDB(); // Ensure DB connection

  try {
    await client.query("BEGIN"); // Start transaction

    // Insert new team and get its ID
    const teamRes = await client.query(
      "INSERT INTO teams (name) VALUES ($1) RETURNING id",
      [teamName]
    );
    const teamId = teamRes.rows[0].id;

    // Associate user with the new team
    await client.query(
      "INSERT INTO user_teams_link (user_id, team_id) VALUES ($1, $2)",
      [userId, teamId]
    );

    await client.query("COMMIT"); // Commit transaction
    return teamId; // Return the new team ID
  } catch (error) {
    await client.query("ROLLBACK"); // Rollback on error
    console.error("Transaction Error:", error);
    throw new Error("Failed to create team and add user.");
  }
}

export async function getTeams(userId) {
  if (!client) await connectDB(); // Ensure DB connection

  // Replace with actual user ID
  try {
    const result = await client.query(
      `
  SELECT t.id, t.name
  FROM teams t
  JOIN user_teams_link ut ON t.id = ut.team_id
  WHERE ut.user_id = $1`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error("Error Getting TeamsL ", error);
    throw new Error("Failed to get teams from user");
  }
}

// TO:DO DB Querys
/*
    Join Team - GetMembersofTeam
    Send Message
    
*/

// Dashboard Hydration

// Navbar Email
export async function getEmail(user_id) {
  if (!client) await connectDB();
  const query = `
  SELECT email FROM users WHERE id = $1
  `;
  const values = [user_id];

  try {
    const res = await client.query(query, values);
    return res.rows[0].email;
  } catch (error) {
    throw new Error(`Some Error ${error}`);
  }
}

// NOTIFICATION FUNCTIONALITY
// getAllNotifications
// handleNotification
// sendNotification

async function getUserIdFromEmail(email) {
  if (!client) await connectDB();
  const query = `SELECT id FROM users WHERE email = $1`;
  const values = [email];

  try {
    const res = await client.query(query, values);
    return res.rows.length > 0 ? res.rows[0].id : null;
  } catch (error) {
    throw new Error(`Error getting userId from email: ${error.message}`);
  }
}
export async function validateInviter(user_id, team_id) {
  // If user is part of team, return true;
  if (!client) await connectDB();

  // Check if user is part of team
  const query = `SELECT 1 FROM user_teams_link WHERE team_id = $1 AND user_id = $2`;
  const values = [team_id, user_id];

  try {
    const result = await client.query(query, values);
    return result.rows.length > 0; // Returns true if user is in team, false otherwise
  } catch (error) {
    throw new Error(`Error validating team membership: ${error.message}`);
  }
}

export async function sendInvite(
  sender_id,
  recipient_email,
  team_invited_to_id
) {
  if (!client) await connectDB();

  const recipient_id = await getUserIdFromEmail(recipient_email);
  if (!recipient_id) {
    throw new Error(`No such user exists with email ${recipient_email}`);
  }

  const query = `
    INSERT INTO invitations (team_id, inviter_id, invitee_id, status) 
    VALUES ($1, $2, $3, 'pending')
  `;
  const values = [team_invited_to_id, sender_id, recipient_id];

  try {
    const res = await client.query(query, values);
    return res.rowCount === 1
      ? { success: true, message: "Invitation sent successfully" }
      : { success: false, message: "Failed to send invitation" };
  } catch (error) {
    throw new Error(`Error sending invitation: ${error.message}`);
  }
}
// Internal Validate Invite Function and Reject Invite
async function validateInvite(invite_id, invitee_id) {
  if (!client) await connectDB();
  const query = `
    SELECT team_id, status FROM invitations 
    WHERE id = $1 AND invitee_id = $2
  `;
  const values = [invite_id, invitee_id];
  const result = await client.query(query, values);
  if (result.rows.length === 0) {
    throw new Error("Invalid Invitation or unauthorized access");
  }
  const { team_id, status } = result.rows[0];

  if (status !== "pending") {
    throw new Error("This invitation has already been processed");
  }
  return team_id;
}

async function updateInviteStatus(invite_id, status) {
  if (!client) await connectDB();
  const query = `
    UPDATE invitations 
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const values = [status, invite_id];
  const result = await client.query(query, values);
  return result.rows[0];
}

export async function handleInvite(invite_id, invitee_id, action) {
  if (!client) await connectDB();
  try {
    // Validate Invite
    const team_id = await validateInvite(invite_id, invitee_id);

    if (action === "accept") {
      // Add invitee to the team
      const addUserQuery = `
        INSERT INTO user_teams_link (user_id, team_id) 
        VALUES ($1, $2) 
        ON CONFLICT DO NOTHING
      `;
      await client.query(addUserQuery, [invitee_id, team_id]);

      // Update invitation status
      await updateInviteStatus(invite_id, "accepted");

      return { success: true, message: "Invitation accepted successfully" };
    } else if (action === "reject") {
      // Update invitation status instead of deleting
      await updateInviteStatus(invite_id, "rejected");

      return { success: true, message: "Invitation rejected successfully" };
    } else {
      throw new Error("Invalid action specified");
    }
  } catch (error) {
    throw new Error(`Error handling invitation: ${error.message}`);
  }
}
export async function getAllNotifications(user_id) {
  if (!client) await connectDB();
  try {
    const query = `
    SELECT i.*, t.name as team_name, u.email as inviter_email 
    FROM invitations i
    JOIN teams t ON i.team_id = t.id
    JOIN users u ON i.inviter_id = u.id
    WHERE i.invitee_id = $1
    ORDER BY i.created_at DESC
    `;
    const values = [user_id];
    const result = await client.query(query, values);

    return result.rows;
  } catch (error) {
    throw new Error(`Error fetching notifications: ${error.message}`);
  }
}

// Messaging In Teams
/*

View Participants
Send Message (validate if can)
View All Messages (validate if can)


*/

// Use this method before any of the message methods (middleware)
export async function validateUserInTeam(user_id, team_id) {
  return { success: false };
}

// MEssage Methods
export async function getAllParticipantsInTeam(user_id, team_id) {}
export async function viewMessagesInTeam(team_id) {}

export async function sendMessageInTeam(user_id, team_id) {}

process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});
