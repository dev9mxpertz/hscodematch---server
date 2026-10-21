import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { parse } from "../../lib/validate.js";
import { loginLimiter } from "../../middleware/rate-limit.js";
import { requireAdmin } from "../../middleware/auth.js";
import { AdminUserModel } from "./admin-user.model.js";
import { login } from "./auth.service.js";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  res.json({ data: await login(email, password) });
});

authRouter.get("/me", requireAdmin, async (_req, res) => {
  const user = await AdminUserModel.findById(res.locals.admin.sub).lean();
  if (!user) throw HttpError.unauthorized("Account no longer exists");
  res.json({ data: { id: String(user._id), email: user.email, name: user.name } });
});
