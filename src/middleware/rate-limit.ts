import { rateLimit } from "express-rate-limit";
import { isTest } from "../config/env.js";

const common = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" },
  },
};

/** Public form submissions: 10 per 15 minutes per IP. */
export const formLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 10 });

/** Sign-in, sign-up and password-reset attempts (admin and visitors): 10 per 15 minutes per IP. */
export const loginLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 10 });

/** General API traffic: 300 per minute per IP. */
export const apiLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 300 });
