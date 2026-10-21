/**
 * Creates the admin account, or resets its password if it already exists.
 *   npm run create-admin                          # uses ADMIN_EMAIL / ADMIN_PASSWORD from .env
 *   npm run create-admin -- you@example.com 'a-long-password' "Your Name"
 */
import { z } from "zod";
import { env } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../db/connect.js";
import { logger } from "../lib/logger.js";
import { upsertAdmin } from "../modules/auth/auth.service.js";

const [argEmail, argPassword, argName] = process.argv.slice(2);

const input = z
  .object({
    email: z.email("Provide a valid email (argument or ADMIN_EMAIL)"),
    password: z.string().min(12, "Password must be at least 12 characters"),
    name: z.string().min(1).default("Administrator"),
  })
  .safeParse({
    email: argEmail ?? env.ADMIN_EMAIL,
    password: argPassword ?? env.ADMIN_PASSWORD,
    name: argName,
  });

if (!input.success) {
  logger.error(input.error.issues.map((i) => i.message).join("; "));
  process.exit(1);
}

try {
  await connectDatabase(env.MONGODB_URI);
  const admin = await upsertAdmin(input.data.email, input.data.password, input.data.name);
  logger.info({ email: admin?.email }, "Admin account ready");
} catch (err) {
  logger.error({ err }, "Could not create admin");
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
