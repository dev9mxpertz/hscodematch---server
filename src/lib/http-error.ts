/** An error that maps directly to an HTTP response. Throw it from any handler. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, "BAD_REQUEST", message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new HttpError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "You do not have access to this resource") {
    return new HttpError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Resource not found") {
    return new HttpError(404, "NOT_FOUND", message);
  }
  static conflict(message: string) {
    return new HttpError(409, "CONFLICT", message);
  }
}
