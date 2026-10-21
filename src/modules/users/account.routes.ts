import { Router } from "express";
import { z } from "zod";
import { escapeRegex, paginationMeta, paginationQuery } from "../../lib/pagination.js";
import { HttpError } from "../../lib/http-error.js";
import { objectIdParams, parse } from "../../lib/validate.js";
import { loginLimiter } from "../../middleware/rate-limit.js";
import { requireUser } from "../../middleware/auth.js";
import * as account from "./account.service.js";
import { UserModel, publicUser } from "./user.model.js";

const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128)
  .regex(/[a-zA-Z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.email("Enter a valid email address"),
  company: z.string().trim().max(160).optional(),
  password,
});

const signInSchema = z.object({ email: z.email(), password: z.string().min(1) });
const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    company: z.string().trim().max(160),
  })
  .partial();
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});
const forgotSchema = z.object({ email: z.email("Enter a valid email address") });
const resetSchema = z.object({ token: z.string().regex(/^[a-f\d]{64}$/), password });

/* ---------- /api/v1/account (website visitors) ---------- */

export const accountRouter = Router();

accountRouter.post("/signup", loginLimiter, async (req, res) => {
  res.status(201).json({ data: await account.signUp(parse(signUpSchema, req.body)) });
});

accountRouter.post("/signin", loginLimiter, async (req, res) => {
  const { email, password: pw } = parse(signInSchema, req.body);
  res.json({ data: await account.signIn(email, pw) });
});

accountRouter.post("/forgot-password", loginLimiter, async (req, res) => {
  await account.requestPasswordReset(parse(forgotSchema, req.body).email);
  res.json({ data: { sent: true } });
});

accountRouter.post("/reset-password", loginLimiter, async (req, res) => {
  const { token, password: pw } = parse(resetSchema, req.body);
  await account.resetPassword(token, pw);
  res.json({ data: { reset: true } });
});

accountRouter.get("/me", requireUser, async (_req, res) => {
  res.json({ data: await account.getAccount(res.locals.user.sub) });
});

accountRouter.patch("/me", requireUser, async (req, res) => {
  const changes = parse(profileSchema, req.body);
  res.json({ data: await account.updateAccount(res.locals.user.sub, changes) });
});

accountRouter.post("/change-password", requireUser, async (req, res) => {
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
  await account.changePassword(res.locals.user.sub, currentPassword, newPassword);
  res.json({ data: { changed: true } });
});

/* ---------- /api/v1/admin/users ---------- */

export const userAdminRouter = Router();

const listQuery = paginationQuery.extend({
  status: z.enum(["active", "disabled"]).optional(),
  q: z.string().trim().max(100).optional(),
});

userAdminRouter.get("/", async (req, res) => {
  const { page, limit, status, q } = parse(listQuery, req.query);
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: pattern }, { email: pattern }, { company: pattern }];
  }
  const [items, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    UserModel.countDocuments(filter),
  ]);
  res.json({ data: items.map(publicUser), meta: paginationMeta({ page, limit }, total) });
});

userAdminRouter.patch("/:id", async (req, res) => {
  const { id } = parse(objectIdParams, req.params);
  const { status } = parse(z.object({ status: z.enum(["active", "disabled"]) }), req.body);
  const user = await UserModel.findByIdAndUpdate(
    id,
    { status },
    { returnDocument: "after" },
  ).lean();
  if (!user) throw HttpError.notFound();
  res.json({ data: publicUser(user) });
});

userAdminRouter.delete("/:id", async (req, res) => {
  const { id } = parse(objectIdParams, req.params);
  const deleted = await UserModel.findByIdAndDelete(id);
  if (!deleted) throw HttpError.notFound();
  res.status(204).end();
});
