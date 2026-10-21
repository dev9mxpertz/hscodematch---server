import { Router } from "express";
import { Schema, model } from "mongoose";
import { z } from "zod";
import { adminCrudRouter } from "./admin-crud-router.js";

/* ---------- model ---------- */

const testimonialSchema = new Schema(
  {
    quote: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    /** Tailwind gradient classes for the initials avatar on the website. */
    avatarClassName: { type: String, default: "from-[#6c4af6] to-[#4f2ed8]" },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const TestimonialModel = model("Testimonial", testimonialSchema);

/* ---------- validation ---------- */

export const testimonialInputSchema = z.object({
  quote: z.string().trim().min(1).max(600),
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(120),
  avatarClassName: z.string().trim().max(120).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
});

/* ---------- routes ---------- */

/** GET /api/v1/testimonials */
export const testimonialPublicRouter = Router();

testimonialPublicRouter.get("/", async (_req, res) => {
  const testimonials = await TestimonialModel.find({ active: true }, "-active")
    .sort({ order: 1 })
    .lean();
  res.json({ data: testimonials });
});

/** /api/v1/admin/testimonials */
export const testimonialAdminRouter = adminCrudRouter({
  model: TestimonialModel,
  createSchema: testimonialInputSchema,
  sort: { order: 1 },
});
