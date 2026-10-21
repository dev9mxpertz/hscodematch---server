import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { Model } from "mongoose";
import { HttpError } from "../../lib/http-error.js";
import { escapeRegex, paginationMeta, paginationQuery } from "../../lib/pagination.js";
import { objectIdParams, parse } from "../../lib/validate.js";

/** Workflow state shared by contact messages and expert inquiries. */
export const SUBMISSION_STATUSES = ["new", "read", "archived"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * Hidden "website" field rendered off-screen in the forms. People never fill it in;
 * spam bots usually do. Requests with a value are accepted but silently dropped.
 */
export const honeypot = { website: z.string().max(200).optional() };
export const isSpam = (body: { website?: string }) => Boolean(body.website?.trim());

const listQuery = paginationQuery.extend({
  status: z.enum(SUBMISSION_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});

const updateBody = z.object({ status: z.enum(SUBMISSION_STATUSES) });

/**
 * Admin endpoints for a submission collection:
 * GET / (filter by status, search), GET /:id, PATCH /:id (status), DELETE /:id.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function submissionAdminRouter(SubmissionModel: Model<any>, searchFields: string[]) {
  const router = Router();

  const list: RequestHandler = async (req, res) => {
    const { page, limit, status, q } = parse(listQuery, req.query);
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) {
      const pattern = new RegExp(escapeRegex(q), "i");
      filter.$or = searchFields.map((field) => ({ [field]: pattern }));
    }
    const [items, total] = await Promise.all([
      SubmissionModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SubmissionModel.countDocuments(filter),
    ]);
    res.json({ data: items, meta: paginationMeta({ page, limit }, total) });
  };

  router.get("/", list);

  router.get("/:id", async (req, res) => {
    const { id } = parse(objectIdParams, req.params);
    const item = await SubmissionModel.findById(id).lean();
    if (!item) throw HttpError.notFound();
    res.json({ data: item });
  });

  router.patch("/:id", async (req, res) => {
    const { id } = parse(objectIdParams, req.params);
    const { status } = parse(updateBody, req.body);
    const item = await SubmissionModel.findByIdAndUpdate(
      id,
      { status },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!item) throw HttpError.notFound();
    res.json({ data: item });
  });

  router.delete("/:id", async (req, res) => {
    const { id } = parse(objectIdParams, req.params);
    const deleted = await SubmissionModel.findByIdAndDelete(id);
    if (!deleted) throw HttpError.notFound();
    res.status(204).end();
  });

  return router;
}
