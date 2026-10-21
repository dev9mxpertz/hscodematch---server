import { Router } from "express";
import { Schema, model } from "mongoose";
import { z } from "zod";
import { parse } from "../../lib/validate.js";
import { adminCrudRouter } from "./admin-crud-router.js";

export const SERVICE_CATEGORIES = [
  "Artificial Intelligence",
  "Developer API",
  "How to Guide",
  "HS Code & Tariffs",
  "Regulations",
] as const;

/* ---------- model ---------- */

const serviceSchema = new Schema(
  {
    category: { type: String, required: true, enum: SERVICE_CATEGORIES, index: true },
    title: { type: String, required: true, trim: true, unique: true },
    description: { type: String, required: true, trim: true },
    href: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ServiceModel = model("Service", serviceSchema);

/* ---------- validation ---------- */

export const serviceInputSchema = z.object({
  category: z.enum(SERVICE_CATEGORIES),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(300),
  href: z.string().trim().min(1).max(500),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
});

/* ---------- routes ---------- */

/** GET /api/v1/services?category= */
export const servicePublicRouter = Router();

servicePublicRouter.get("/", async (req, res) => {
  const { category } = parse(
    z.object({ category: z.enum(SERVICE_CATEGORIES).optional() }),
    req.query,
  );
  const services = await ServiceModel.find(
    { active: true, ...(category && { category }) },
    "-active",
  )
    .sort({ order: 1 })
    .lean();
  res.json({ data: services });
});

/** /api/v1/admin/services */
export const serviceAdminRouter = adminCrudRouter({
  model: ServiceModel,
  createSchema: serviceInputSchema,
  filters: { category: z.enum(SERVICE_CATEGORIES).optional() },
  sort: { order: 1 },
});
