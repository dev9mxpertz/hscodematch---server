import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { isProduction } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Route ${req.method} ${req.path} not found`));
};

type ErrorBody = { error: { code: string; message: string; details?: unknown } };

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;

  if (err instanceof mongoose.Error.CastError) {
    return HttpError.badRequest(`Invalid value for "${err.path}"`);
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return HttpError.badRequest("Validation failed", details);
  }
  // Duplicate key from a unique index
  if (typeof err === "object" && err !== null && "code" in err && err.code === 11000) {
    const fields = Object.keys((err as { keyValue?: object }).keyValue ?? {});
    return HttpError.conflict(`A record with this ${fields.join(", ") || "value"} already exists`);
  }
  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    return HttpError.badRequest("Request body is not valid JSON");
  }
  // Body too large etc. from body-parser
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof err.status === "number"
  ) {
    const status = err.status;
    if (status >= 400 && status < 500) {
      const message = "message" in err ? String(err.message) : "Bad request";
      return new HttpError(status, "BAD_REQUEST", message);
    }
  }
  return new HttpError(500, "INTERNAL_ERROR", "Something went wrong");
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const httpError = toHttpError(err);

  if (httpError.status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  }

  const body: ErrorBody = {
    error: { code: httpError.code, message: httpError.message, details: httpError.details },
  };
  // Never leak stack traces in production
  if (!isProduction && httpError.status >= 500 && err instanceof Error) {
    body.error.details = err.stack;
  }
  res.status(httpError.status).json(body);
};
