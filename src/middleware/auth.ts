import type { RequestHandler } from "express";
import { bearerToken, verifyToken } from "../lib/tokens.js";

/** Requires an admin token; exposes it as `res.locals.admin`. */
export const requireAdmin: RequestHandler = (req, res, next) => {
  res.locals.admin = verifyToken(bearerToken(req.get("authorization")), "admin");
  next();
};

/** Requires a signed-in website visitor; exposes it as `res.locals.user`. */
export const requireUser: RequestHandler = (req, res, next) => {
  res.locals.user = verifyToken(bearerToken(req.get("authorization")), "user");
  next();
};
