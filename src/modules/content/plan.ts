import { Router } from "express";
import { Schema, model } from "mongoose";
import { z } from "zod";
import { parse } from "../../lib/validate.js";
import { adminCrudRouter } from "./admin-crud-router.js";

export const PLAN_KINDS = ["app", "api"] as const;
export const PLAN_PERIODS = ["month", "14 days"] as const;

/* ---------- model ---------- */

const planSchema = new Schema(
  {
    kind: { type: String, required: true, enum: PLAN_KINDS, index: true },
    name: { type: String, required: true, trim: true },
    /** Price in USD for the period. */
    price: { type: Number, required: true, min: 0 },
    period: { type: String, required: true, enum: PLAN_PERIODS },
    description: { type: String, required: true, trim: true },
    features: { type: [String], default: [] },
    cta: {
      label: { type: String, required: true, trim: true },
      href: { type: String, required: true, trim: true },
    },
    popular: { type: Boolean, default: false },
    /** Display order within its kind (ascending). */
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
planSchema.index({ kind: 1, name: 1 }, { unique: true });

export const PlanModel = model("Plan", planSchema);

/* ---------- validation ---------- */

export const planInputSchema = z.object({
  kind: z.enum(PLAN_KINDS),
  name: z.string().trim().min(1).max(60),
  price: z.number().min(0),
  period: z.enum(PLAN_PERIODS),
  description: z.string().trim().min(1).max(300),
  features: z.array(z.string().trim().min(1).max(120)).max(20),
  cta: z.object({
    label: z.string().trim().min(1).max(40),
    href: z.string().trim().min(1).max(500),
  }),
  popular: z.boolean().optional(),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
});

/* ---------- routes ---------- */

/** GET /api/v1/plans?kind=app|api */
export const planPublicRouter = Router();

planPublicRouter.get("/", async (req, res) => {
  const { kind } = parse(z.object({ kind: z.enum(PLAN_KINDS).optional() }), req.query);
  const plans = await PlanModel.find({ active: true, ...(kind && { kind }) }, "-active")
    .sort({ kind: 1, order: 1 })
    .lean();
  res.json({ data: plans });
});

/** /api/v1/admin/plans */
export const planAdminRouter = adminCrudRouter({
  model: PlanModel,
  createSchema: planInputSchema,
  filters: { kind: z.enum(PLAN_KINDS).optional() },
  sort: { kind: 1, order: 1 },
});
