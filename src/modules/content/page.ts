import { Router } from "express";
import { Schema, model } from "mongoose";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { parse } from "../../lib/validate.js";
import { adminCrudRouter } from "./admin-crud-router.js";

/**
 * Simple Markdown pages such as About, Terms and Privacy. Each one is served by
 * the website at /<slug>/.
 */

/** Slugs already used by website routes. */
const RESERVED_SLUGS = [
  "account",
  "admin",
  "api",
  "blog",
  "contact",
  "forgot-password",
  "pricing",
  "reset-password",
  "services",
  "signin",
  "signup",
  "support",
];

/* ---------- model ---------- */

const pageSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true },
    /** Short intro under the title; also used as the meta description. */
    summary: { type: String, default: "", trim: true },
    /** Page content in Markdown. */
    body: { type: String, default: "" },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const PageModel = model("Page", pageSchema);

/* ---------- validation ---------- */

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")
  .refine((value) => !RESERVED_SLUGS.includes(value), "This address is used by another page");

export const pageInputSchema = z.object({
  slug,
  title: z.string().trim().min(1).max(150),
  summary: z.string().trim().max(300).optional(),
  body: z.string().max(100_000).optional(),
  published: z.boolean().optional(),
});

/* ---------- routes ---------- */

/** GET /api/v1/pages (slugs for the sitemap) and /api/v1/pages/:slug */
export const pagePublicRouter = Router();

pagePublicRouter.get("/", async (_req, res) => {
  const pages = await PageModel.find({ published: true }, "slug title updatedAt")
    .sort({ slug: 1 })
    .lean();
  res.json({ data: pages });
});

pagePublicRouter.get("/:slug", async (req, res) => {
  const { slug: pageSlug } = parse(z.object({ slug: z.string().max(100) }), req.params);
  const page = await PageModel.findOne(
    { slug: pageSlug.toLowerCase(), published: true },
    "slug title summary body updatedAt",
  ).lean();
  if (!page) throw HttpError.notFound("Page not found");
  res.json({ data: page });
});

/** /api/v1/admin/pages */
export const pageAdminRouter = adminCrudRouter({
  model: PageModel,
  createSchema: pageInputSchema,
  sort: { slug: 1 },
});
