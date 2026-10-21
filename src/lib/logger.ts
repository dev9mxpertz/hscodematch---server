import { pino } from "pino";
import { env, isProduction } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.passwordHash"],
  // Human-readable output locally; JSON lines in production for log tooling.
  transport: isProduction ? undefined : { target: "pino-pretty", options: { colorize: true } },
});
