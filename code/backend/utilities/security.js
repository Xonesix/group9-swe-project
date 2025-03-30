// Hashing and Salting Passwords
import bcrypt from "bcrypt";

async function hashPassword(password) {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
}

async function verifyPassword(password, hash) {
  const match = await bcrypt.compare(password, hash);
  return match; // true if correct, false otherwise
}

export { hashPassword, verifyPassword };
