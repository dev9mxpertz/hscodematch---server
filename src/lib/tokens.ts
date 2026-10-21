import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "./http-error.js";

/** Who a token is for. Admin and visitor tokens are never interchangeable. */
export type Audience = "admin" | "user";

export type TokenPayload = { sub: string; email: string };

const ISSUER = "hscodematch-api";

export function signToken(payload: TokenPayload, audience: Audience) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: (audience === "admin"
      ? env.JWT_EXPIRES_IN
      : env.USER_JWT_EXPIRES_IN) as SignOptions["expiresIn"],
    issuer: ISSUER,
    audience,
  });
}

export function verifyToken(token: string, audience: Audience): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: ISSUER, audience });
    if (typeof decoded === "string" || !decoded.sub) throw new Error("Malformed token");
    return { sub: decoded.sub, email: String(decoded.email) };
  } catch {
    throw HttpError.unauthorized("Invalid or expired token");
  }
}

/** Reads `Authorization: Bearer <token>`. */
export function bearerToken(header: string | undefined) {
  const [scheme, token] = (header ?? "").split(" ");
  if (scheme !== "Bearer" || !token) throw HttpError.unauthorized();
  return token;
}
