import { Router } from "express";
import { Schema, model } from "mongoose";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { escapeRegex, paginationMeta, paginationQuery } from "../../lib/pagination.js";
import { parse } from "../../lib/validate.js";
import { adminCrudRouter } from "./admin-crud-router.js";

export const POST_CATEGORIES = [
  "Trade Compliance",
  "AI & Automation",
  "Product Updates",
  "Customs Law",
  "Global Logistics",
  "Case Studies",
] as const;

export const TAG_TONES = ["blue", "green", "red", "purple", "orange", "lime"] as const;

/* ---------- model ---------- */

const postSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    excerpt: { type: String, required: true, trim: true, maxlength: 500 },
    /** Article body in Markdown. */
    body: { type: String, default: "" },
    category: { type: String, required: true, enum: POST_CATEGORIES, index: true },
    /** Label shown on the card; may differ from the filter category. */
    label: { type: String, required: true, trim: true },
    tone: { type: String, required: true, enum: TAG_TONES },
    /** Image URL or path under the website's public folder, e.g. /blog/port.jpg */
    image: { type: String, required: true, trim: true },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    publishedAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true },
);

export const PostModel = model("Post", postSchema);

/* ---------- validation ---------- */

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes");

export const postInputSchema = z.object({
  slug,
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().min(1).max(500),
  body: z.string().max(100_000).optional(),
  category: z.enum(POST_CATEGORIES),
  label: z.string().trim().min(1).max(60),
  tone: z.enum(TAG_TONES),
  image: z.string().trim().min(1).max(500),
  status: z.enum(["draft", "published"]).optional(),
  publishedAt: z.coerce.date().optional(),
});

/* ---------- public routes: /api/v1/posts ---------- */

const PUBLIC_FIELDS = "slug title excerpt category label tone image publishedAt";
const published = () => ({ status: "published" as const, publishedAt: { $lte: new Date() } });

const listQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(100).default(6),
  category: z.enum(POST_CATEGORIES).optional(),
  q: z.string().trim().max(100).optional(),
});

export const postPublicRouter = Router();

postPublicRouter.get("/", async (req, res) => {
  const { page, limit, category, q } = parse(listQuery, req.query);
  const filter: Record<string, unknown> = published();
  if (category) filter.category = category;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: pattern }, { excerpt: pattern }, { label: pattern }];
  }

  const [items, total] = await Promise.all([
    PostModel.find(filter, PUBLIC_FIELDS)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PostModel.countDocuments(filter),
  ]);
  res.json({ data: items, meta: paginationMeta({ page, limit }, total) });
});

postPublicRouter.get("/:slug", async (req, res) => {
  const { slug: postSlug } = parse(z.object({ slug }), req.params);
  const post = await PostModel.findOne(
    { slug: postSlug, ...published() },
    `${PUBLIC_FIELDS} body`,
  ).lean();
  if (!post) throw HttpError.notFound("Post not found");

  const related = await PostModel.find(
    { ...published(), category: post.category, slug: { $ne: post.slug } },
    "slug title publishedAt",
  )
    .sort({ publishedAt: -1 })
    .limit(3)
    .lean();
  res.json({ data: { ...post, related } });
});

/* ---------- admin routes: /api/v1/admin/posts ---------- */

export const postAdminRouter = adminCrudRouter({
  model: PostModel,
  createSchema: postInputSchema,
  filters: {
    status: z.enum(["draft", "published"]).optional(),
    category: z.enum(POST_CATEGORIES).optional(),
  },
  sort: { publishedAt: -1 },
});
