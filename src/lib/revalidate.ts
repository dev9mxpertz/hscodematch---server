import type { RequestHandler } from "express";
import { env, isTest } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * Tells the website to drop its cached content so admin edits show up on the
 * next page view. Configured with REVALIDATE_URL + REVALIDATE_SECRET; without
 * them the website still refreshes on its own every few minutes.
 */
export async function revalidateWebsite() {
  if (!env.REVALIDATE_URL || !env.REVALIDATE_SECRET || isTest) return false;
  try {
    const res = await fetch(env.REVALIDATE_URL, {
      method: "POST",
      headers: { "x-revalidate-secret": env.REVALIDATE_SECRET },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Website responded ${res.status}`);
    return true;
  } catch (err) {
    logger.warn({ err }, "Could not refresh the website cache");
    return false;
  }
}

/** After any successful change (POST/PUT/PATCH/DELETE) on these routes, refresh the website. */
export const revalidateOnChange: RequestHandler = (req, res, next) => {
  if (req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode < 400) void revalidateWebsite();
    });
  }
  next();
};
