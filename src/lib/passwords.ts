import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

// Compared against when an account doesn't exist, so response time doesn't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

/** Constant-work password check; pass `undefined` when the account wasn't found. */
export const checkPassword = (password: string, hash: string | undefined) =>
  bcrypt.compare(password, hash ?? DUMMY_HASH);

/** One-time token for links sent by email (password reset). Only the hash is stored. */
export function createOneTimeToken() {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashOneTimeToken(token) };
}

export const hashOneTimeToken = (token: string) => createHash("sha256").update(token).digest("hex");
