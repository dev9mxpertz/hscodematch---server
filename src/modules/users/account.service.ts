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

const PLAN_QUOTAS: Record<string, { lookups: number; apiCalls: number }> = {
  "Free Trial": { lookups: 50, apiCalls: 1000 },
  Starter: { lookups: 500, apiCalls: 5000 },
  Premium: { lookups: 2500, apiCalls: 20000 },
  Business: { lookups: 10000, apiCalls: 50000 },
  Sandbox: { lookups: 20, apiCalls: 1000 },
  Developer: { lookups: 500, apiCalls: 10000 },
  Growth: { lookups: 2500, apiCalls: 50000 },
  Enterprise: { lookups: 50000, apiCalls: 1000000 },
};

export async function subscribe(
  userId: string,
  input: {
    planName: string;
    planKind?: "app" | "api";
    price: number;
    period?: "month" | "14 days" | "year";
    paymentMethod?: string;
  },
) {
  const user = await UserModel.findById(userId);
  if (!user || user.status === "disabled") throw HttpError.unauthorized("Account not available");

  const quota = PLAN_QUOTAS[input.planName] ?? { lookups: 500, apiCalls: 5000 };
  const durationDays = input.period === "14 days" ? 14 : input.period === "year" ? 365 : 30;
  const now = new Date();
  const renewsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const invoiceNum = `INV-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  user.set("subscription", {
    planName: input.planName,
    planKind: input.planKind ?? "app",
    price: input.price,
    period: input.period ?? "month",
    status: "active",
    startDate: now,
    renewsAt,
    lookupsLimit: quota.lookups,
    lookupsUsed: 0,
    apiCallsLimit: quota.apiCalls,
    apiCallsUsed: 0,
  });

  const transaction = {
    invoiceNumber: invoiceNum,
    planName: input.planName,
    amount: input.price,
    currency: "USD",
    status: "paid",
    date: now,
    paymentMethod: input.paymentMethod || "Credit Card (ending in 4242)",
  };

  user.transactions.unshift(transaction as any);
  await user.save();
  return publicUser(user);
}

export async function cancelSubscription(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user || user.status === "disabled") throw HttpError.unauthorized("Account not available");

  if (user.subscription) {
    user.subscription.status = "canceled";
    await user.save();
  }
  return publicUser(user);
}

export async function adminUpdateSubscription(
  userId: string,
  input: {
    planName?: string;
    planKind?: "app" | "api";
    status?: "active" | "trialing" | "canceled" | "past_due";
    price?: number;
    lookupsLimit?: number;
    lookupsUsed?: number;
    apiCallsLimit?: number;
    apiCallsUsed?: number;
  },
) {
  const user = await UserModel.findById(userId);
  if (!user) throw HttpError.notFound("User not found");

  if (user.subscription) {
    if (input.planName) user.subscription.planName = input.planName;
    if (input.planKind) user.subscription.planKind = input.planKind;
    if (input.status) user.subscription.status = input.status;
    if (input.price !== undefined) user.subscription.price = input.price;
    if (input.lookupsLimit !== undefined) user.subscription.lookupsLimit = input.lookupsLimit;
    if (input.lookupsUsed !== undefined) user.subscription.lookupsUsed = input.lookupsUsed;
    if (input.apiCallsLimit !== undefined) user.subscription.apiCallsLimit = input.apiCallsLimit;
    if (input.apiCallsUsed !== undefined) user.subscription.apiCallsUsed = input.apiCallsUsed;
  }
  await user.save();
  return publicUser(user);
}
