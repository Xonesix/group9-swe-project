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
    throw Error(`Some Error ${error}`);
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

export async function handleInvite(invite_id, invitee_id) {
  // Check if this invitee is authorized to even handle this particular invite FIRST
  //  Update time updated && status of invite
  // Add user to team if accepted
}
export async function getAllNotifications(user_id) {}

process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});
