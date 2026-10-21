/**
 * Loads starter website content into MongoDB.
 *   npm run seed            # insert / update
 *   npm run seed -- --reset # wipe content collections first (submissions are never touched)
 */
import { env } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../db/connect.js";
import { logger } from "../lib/logger.js";
import { seedContent } from "../seed/seed-content.js";

const reset = process.argv.includes("--reset");

try {
  await connectDatabase(env.MONGODB_URI);
  const summary = await seedContent({ reset });
  logger.info({ summary, reset }, "Seed complete");
} catch (err) {
  logger.error({ err }, "Seed failed");
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
