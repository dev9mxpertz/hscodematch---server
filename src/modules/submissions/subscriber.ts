import { Router } from "express";
import { Schema, model } from "mongoose";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { escapeRegex, paginationMeta, paginationQuery } from "../../lib/pagination.js";
import { objectIdParams, parse } from "../../lib/validate.js";
import { formLimiter } from "../../middleware/rate-limit.js";
import { honeypot, isSpam } from "./submission.js";

/* ---------- model ---------- */

const subscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    status: {
      type: String,
      enum: ["subscribed", "unsubscribed"],
      default: "subscribed",
      index: true,
    },
    unsubscribedAt: { type: Date },
  },
  { timestamps: true },
);

export const SubscriberModel = model("Subscriber", subscriberSchema);

/* ---------- validation ---------- */

const subscribeSchema = z.object({ email: z.email("Enter a valid email address"), ...honeypot });

/* ---------- routes ---------- */

/** POST /api/v1/newsletter — blog newsletter box. Subscribing twice is not an error. */
export const newsletterPublicRouter = Router();

newsletterPublicRouter.post("/", formLimiter, async (req, res) => {
  const { email, website } = parse(subscribeSchema, req.body);
  if (!isSpam({ website })) {
    await SubscriberModel.updateOne(
      { email: email.toLowerCase() },
      { $set: { status: "subscribed" }, $unset: { unsubscribedAt: 1 } },
      { upsert: true },
    );
  }
  res.status(201).json({ data: { subscribed: true } });
});

/** /api/v1/admin/subscribers */
export const subscriberAdminRouter = Router();

const listQuery = paginationQuery.extend({
  status: z.enum(["subscribed", "unsubscribed"]).optional(),
  q: z.string().trim().max(100).optional(),
});

subscriberAdminRouter.get("/", async (req, res) => {
  const { page, limit, status, q } = parse(listQuery, req.query);
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (q) filter.email = new RegExp(escapeRegex(q), "i");

  const [items, total] = await Promise.all([
    SubscriberModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SubscriberModel.countDocuments(filter),
  ]);
  res.json({ data: items, meta: paginationMeta({ page, limit }, total) });
});

/** CSV export of active subscribers, for importing into a mailing tool. */
subscriberAdminRouter.get("/export.csv", async (_req, res) => {
  const subscribers = await SubscriberModel.find({ status: "subscribed" })
    .sort({ createdAt: 1 })
    .lean();
  const rows = subscribers.map((s) => `${s.email},${s.createdAt.toISOString()}`);
  res
    .type("text/csv")
    .attachment("subscribers.csv")
    .send(["email,subscribed_at", ...rows].join("\n"));
});

subscriberAdminRouter.patch("/:id", async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(["subscribed", "unsubscribed"]) }), req.body);
  const update =
    status === "unsubscribed"
      ? { status, unsubscribedAt: new Date() }
      : { status, $unset: { unsubscribedAt: 1 } };
  const item = await SubscriberModel.findByIdAndUpdate(
    parse(objectIdParams, req.params).id,
    update,
    {
      returnDocument: "after",
    },
  ).lean();
  if (!item) throw HttpError.notFound();
  res.json({ data: item });
});

subscriberAdminRouter.delete("/:id", async (req, res) => {
  const deleted = await SubscriberModel.findByIdAndDelete(parse(objectIdParams, req.params).id);
  if (!deleted) throw HttpError.notFound();
  res.status(204).end();
});
