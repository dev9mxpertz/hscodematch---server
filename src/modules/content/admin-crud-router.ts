import { Router } from "express";
import type { Model, SortOrder } from "mongoose";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { paginationMeta, paginationQuery } from "../../lib/pagination.js";
import { objectIdParams, parse } from "../../lib/validate.js";

type Options<C extends z.ZodObject> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  createSchema: C;
  /** Query-string filters the list endpoint accepts, e.g. { kind: z.enum([...]) }. */
  filters?: z.ZodRawShape;
  sort: Record<string, SortOrder>;
};

/**
 * Standard admin endpoints for a content collection:
 * GET / · GET /:id · POST / · PATCH /:id (partial) · DELETE /:id
 */
export function adminCrudRouter<C extends z.ZodObject>({
  model,
  createSchema,
  filters = {},
  sort,
}: Options<C>) {
  const router = Router();
  const filterQuery = z.object(filters);
  const updateSchema = createSchema.partial();

  router.get("/", async (req, res) => {
    const { page, limit } = parse(paginationQuery, req.query);
    const filter = parse(filterQuery, req.query);
    const [items, total] = await Promise.all([
      model
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      model.countDocuments(filter),
    ]);
    res.json({ data: items, meta: paginationMeta({ page, limit }, total) });
  });

  router.get("/:id", async (req, res) => {
    const { id } = parse(objectIdParams, req.params);
    const item = await model.findById(id).lean();
    if (!item) throw HttpError.notFound();
    res.json({ data: item });
  });

  router.post("/", async (req, res) => {
    const item = await model.create(parse(createSchema, req.body));
    res.status(201).json({ data: item.toObject() });
  });

  router.patch("/:id", async (req, res) => {
    const { id } = parse(objectIdParams, req.params);
    const changes = parse(updateSchema, req.body);
    if (Object.keys(changes).length === 0) throw HttpError.badRequest("No fields to update");
    const item = await model
      .findByIdAndUpdate(id, changes, { returnDocument: "after", runValidators: true })
      .lean();
    if (!item) throw HttpError.notFound();
    res.json({ data: item });
  });

  router.delete("/:id", async (req, res) => {
    const { id } = parse(objectIdParams, req.params);
    const deleted = await model.findByIdAndDelete(id);
    if (!deleted) throw HttpError.notFound();
    res.status(204).end();
  });

  return router;
}
