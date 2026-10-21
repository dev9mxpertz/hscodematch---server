import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { sendMail } from "../../lib/mailer.js";
import {
  checkPassword,
  createOneTimeToken,
  hashOneTimeToken,
  hashPassword,
} from "../../lib/passwords.js";
import { signToken } from "../../lib/tokens.js";
import { UserModel, publicUser } from "./user.model.js";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function session(user: Parameters<typeof publicUser>[0] & { id: string; email: string }) {
  return { token: signToken({ sub: user.id, email: user.email }, "user"), user: publicUser(user) };
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  company?: string;
}) {
  const email = input.email.toLowerCase();
  if (await UserModel.exists({ email })) {
    throw HttpError.conflict("An account with this email already exists");
  }
  const user = await UserModel.create({
    name: input.name,
    email,
    company: input.company || undefined,
    passwordHash: await hashPassword(input.password),
    lastLoginAt: new Date(),
  });
  return session(user);
}

export async function signIn(email: string, password: string) {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  const valid = await checkPassword(password, user?.passwordHash);
  if (!user || !valid) throw HttpError.unauthorized("Incorrect email or password");
  if (user.status === "disabled") throw HttpError.forbidden("This account has been disabled");

  user.lastLoginAt = new Date();
  await user.save();
  return session(user);
}

export async function getAccount(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user || user.status === "disabled") throw HttpError.unauthorized("Account not available");
  return publicUser(user);
}

export async function updateAccount(userId: string, changes: { name?: string; company?: string }) {
  const user = await UserModel.findByIdAndUpdate(userId, changes, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!user) throw HttpError.unauthorized("Account not available");
  return publicUser(user);
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await UserModel.findById(userId).select("+passwordHash");
  if (!user || !(await checkPassword(current, user.passwordHash))) {
    throw HttpError.badRequest("Current password is incorrect", [
      { field: "currentPassword", message: "Current password is incorrect" },
    ]);
  }
  user.passwordHash = await hashPassword(next);
  await user.save();
}

/**
 * Emails a one-hour reset link. Always succeeds from the caller's point of view,
 * so the endpoint can't be used to discover which emails have accounts.
 */
export async function requestPasswordReset(email: string) {
  const user = await UserModel.findOne({ email: email.toLowerCase(), status: "active" });
  if (!user) return;

  const { token, hash } = createOneTimeToken();
  await UserModel.updateOne(
    { _id: user._id },
    { resetTokenHash: hash, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  );

  const link = `${env.SITE_URL.replace(/\/+$/, "")}/reset-password/?token=${token}`;
  await sendMail(
    user.email,
    "Reset your HSCodeMatch password",
    [
      `Hi ${user.name},`,
      "",
      "We received a request to reset your HSCodeMatch password. Use the link below within one hour:",
      link,
      "",
      "If you didn't ask for this, you can ignore this email — your password won't change.",
    ].join("\n"),
  );
  return token; // returned for tests only; never sent in an HTTP response
}

export async function resetPassword(token: string, password: string) {
  const user = await UserModel.findOne({
    resetTokenHash: hashOneTimeToken(token),
    resetTokenExpiresAt: { $gt: new Date() },
  });
  if (!user) throw HttpError.badRequest("This reset link is invalid or has expired");

  user.passwordHash = await hashPassword(password);
  user.set({ resetTokenHash: undefined, resetTokenExpiresAt: undefined });
  await user.save();
}
