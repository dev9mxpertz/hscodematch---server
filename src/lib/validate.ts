import { z } from "zod";
import { HttpError } from "./http-error.js";

/**
 * Parses untrusted input (body, query, params) with a Zod schema.
 * Throws a 400 HttpError listing every invalid field.
 */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw HttpError.badRequest("Validation failed", details);
  }
  return result.data;
}

/** Route params containing a MongoDB ObjectId: `/:id`. */
export const objectIdParams = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
});
