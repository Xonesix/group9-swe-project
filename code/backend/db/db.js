import pg from "pg";
import dotenv from "dotenv";
import { query } from "express";
import { hashPassword, verifyPassword } from "../utilities/security.js";
dotenv.config();

const { Pool } = pg;

const client = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  idleTimeoutMillis: 30000,
  max: 5,
});

export async function connectDB() {
  console.log("Connecting to DB (pool)");
  await client.query("SELECT 1");
}
export async function closeDB() {
  await client.end();
  console.log("Database pool closed.");
}

export async function createUser(email, password) {
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
  const query = `
  SELECT email, username FROM users WHERE id = $1
  `;
  const values = [user_id];

  try {
    const res = await client.query(query, values);
    return res.rows[0];
  } catch (error) {
    throw new Error(`Some Error ${error}`);
  }
}

export async function updateUsername(user_id, new_username){
  const query = `UPDATE users SET username = $2 WHERE id = $1`;
  const values = [user_id, new_username];
  console.log("Updating username for: ", user_id)
  console.log("Values: ", values)
  try {
    await client.query("BEGIN"); // begins the transaction
    
    const res = await client.query(query, values); // update the username
    
    await client.query("COMMIT");
    
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating username");
    throw new Error(`Some Error ${error}`);
  }
}

// NOTIFICATION FUNCTIONALITY
// getAllNotifications
// handleNotification
// sendNotification

async function getUserIdFromEmail(email) {
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
  try {
    const query = `
      SELECT i.*, t.name AS team_name, u.email AS inviter_email 
      FROM invitations i
      JOIN teams t ON i.team_id = t.id
      JOIN users u ON i.inviter_id = u.id
      WHERE i.invitee_id = $1 AND i.status = 'pending'
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
  const query = `
    SELECT 1 
    FROM user_teams_link 
    WHERE user_id = $1 AND team_id = $2
    LIMIT 1; 
  `;
  const values = [user_id, team_id];
  try {
    const result = await client.query(query, values);

    // CORRECT CHECK: Check the number of rows returned
    if (result.rows.length === 0) {
      // No row found, user is not in the team
      return false;
    } else {
      // At least one row found (should be exactly one due to PK), user is in the team
      return true;
    }
    // Or more concisely: return result.rows.length > 0;
  } catch (error) {
    console.error("Error validating user in team:", error);
    // Handle query errors appropriately
    // Depending on requirements, you might return false or throw the error
    return false; // Example: treat query error as validation failure
  }
}

// MEssage Methods
export async function getAllParticipantsInTeam(team_id) {
  const query = `
  SELECT u.email
  FROM users u
  INNER JOIN
  user_teams_link utl ON u.id = utl.user_id
  WHERE utl.team_id = $1
  `;
  const values = [team_id];
  if (!client) await connectDB();
  try {
    const result = await client.query(query, values);

    return result.rows;
  } catch (error) {
    throw new Error(error);
  }
}
export async function viewMessagesInTeam(team_id) {
  const query = `
  SELECT m.content, m.created_at, u.email
FROM messages m 
INNER JOIN
users u ON m.sender_id = u.id
INNER JOIN
teams t ON m.team_id = t.id
WHERE t.id = $1
ORDER BY m.created_at ASC
  `;
  const values = [team_id];
  if (!client) await connectDB();
  try {
    const result = await client.query(query, values);

    return result.rows;
  } catch (error) {
    throw new Error(error);
  }
}

export async function sendMessageInTeam(user_id, team_id, content) {
  const query = `
    INSERT into messages (team_id, sender_id, content) VALUES ($1, $2, $3) RETURNING created_at
  `;
  const values = [team_id, user_id, content];
  try {
    const result = await client.query(query, values);

    return { success: true, created_at: result.rows[0] };
  } catch (error) {
    throw new Error(error);
  }
}

export async function deleteUserFromTeam(user_id, team_id) {
  const query = `DELETE FROM user_teams_link WHERE user_id = $1 AND team_id = $2`;
  const values = [user_id, team_id];
  try {
    const result = await client.query(query, values);
    return { success: true };
  } catch (error) {
    throw new Error(error);
  }
}

process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});
