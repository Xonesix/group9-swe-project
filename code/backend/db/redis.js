import { createClient } from "redis";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

let client;

async function getRedisClient() {
  if (!client) {
    client = createClient({
      username: "default",
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    });

    client.on("error", (err) => console.log("Redis Client Error", err));

    await client.connect();
  }

  return client;
}

export async function addSession(user_id) {
  const redis = await getRedisClient();
  const randomId = uuidv4();
  console.log(`Key: ${randomId} Value: ${user_id}`);
  await redis.set(randomId, user_id, {
    EX: 3600,
  });
  return randomId;
}

export async function verifySession(randomId) {
  const redis = await getRedisClient();
  const result = await redis.get(randomId);
  if (result) return { success: true, userId: result };
  else return { success: false };
}

export async function getAllKeys() {
  const redis = await getRedisClient();
  try {
    const keys = await redis.keys("*");
    if (keys.length === 0) {
      console.log("No keys found in the database");
    } else {
      keys.forEach((key, i) => console.log(`${i + 1}. ${key}`));
      console.log(`Total keys: ${keys.length}`);
    }
    return keys;
  } catch (error) {
    console.error("Error getting all keys:", error);
    throw error;
  }
}
