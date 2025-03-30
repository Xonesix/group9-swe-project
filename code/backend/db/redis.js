import { createClient } from "redis";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
dotenv.config();
const client = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

client.on("error", (err) => console.log("Redis Client Error", err));

await client.connect();

async function getAllKeys() {
  try {
    // Use KEYS * to get all keys
    const keys = await client.keys("*");

    console.log("All Redis keys:");
    if (keys.length === 0) {
      console.log("No keys found in the database");
    } else {
      keys.forEach((key, index) => {
        console.log(`${index + 1}. ${key}`);
      });
      console.log(`Total keys: ${keys.length}`);
    }

    return keys;
  } catch (error) {
    console.error("Error getting all keys:", error);
    throw error;
  }
}

export async function addSession(user_id) {
  // generate random id -> return it
  // store it as key
  const randomId = uuidv4();
  console.log(`Key: ${randomId} Value: ${user_id}`);
  await client.set(randomId, user_id, "EX", 3600, (err, reply) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Set key with expiration: ", reply);
    }
  });
  return randomId;
}

export async function verifySession(randomId) {
  const result = await client.get(randomId);
  if (result) return { success: true, userId: result };
  else return { success: false };
}
