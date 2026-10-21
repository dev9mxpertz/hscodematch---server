import { Router } from "express";
import { Schema, model } from "mongoose";
import { z } from "zod";
import { parse } from "../../lib/validate.js";
import { adminCrudRouter } from "./admin-crud-router.js";

/** Which page an FAQ appears on. */
export const FAQ_PAGES = ["home", "pricing"] as const;

/* ---------- model ---------- */

const faqSchema = new Schema(
  {
    page: { type: String, required: true, enum: FAQ_PAGES, index: true },
    question: { type: String, required: true, trim: true },
    /** Answer in Markdown (paragraphs, "- " bullet lists and [links](/path)). */
    answer: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const FaqModel = model("Faq", faqSchema);

/* ---------- validation ---------- */

export const faqInputSchema = z.object({
  page: z.enum(FAQ_PAGES),
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(5000),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
});

/* ---------- routes ---------- */

/** GET /api/v1/faqs?page=home|pricing */
export const faqPublicRouter = Router();

faqPublicRouter.get("/", async (req, res) => {
  const { page } = parse(z.object({ page: z.enum(FAQ_PAGES).optional() }), req.query);
  const faqs = await FaqModel.find({ active: true, ...(page && { page }) }, "-active")
    .sort({ page: 1, order: 1 })
    .lean();
  res.json({ data: faqs });
});

/** /api/v1/admin/faqs */
export const faqAdminRouter = adminCrudRouter({
  model: FaqModel,
  createSchema: faqInputSchema,
  filters: { page: z.enum(FAQ_PAGES).optional() },
  sort: { page: 1, order: 1 },
});
