import { Schema, model, type InferSchemaType } from "mongoose";

const transactionSchema = new Schema({
  invoiceNumber: { type: String, required: true },
  planName: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: "USD" },
  status: { type: String, enum: ["paid", "pending", "refunded"], default: "paid" },
  date: { type: Date, default: Date.now },
  paymentMethod: { type: String, default: "Credit Card (ending in 4242)" },
});

const subscriptionSchema = new Schema({
  planName: { type: String, default: "Free Trial" },
  planKind: { type: String, enum: ["app", "api"], default: "app" },
  price: { type: Number, default: 0 },
  period: { type: String, default: "14 days" },
  status: {
    type: String,
    enum: ["active", "trialing", "canceled", "past_due"],
    default: "trialing",
  },
  startDate: { type: Date, default: Date.now },
  renewsAt: {
    type: Date,
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  },
  lookupsLimit: { type: Number, default: 50 },
  lookupsUsed: { type: Number, default: 0 },
  apiCallsLimit: { type: Number, default: 1000 },
  apiCallsUsed: { type: Number, default: 0 },
});

/** A website visitor account (sign up / sign in on the marketing site). */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    company: { type: String, trim: true, maxlength: 160 },
    passwordHash: { type: String, required: true, select: false },
    /** SHA-256 of the active password-reset token, if any. */
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
    status: { type: String, enum: ["active", "disabled"], default: "active", index: true },
    lastLoginAt: { type: Date },
    subscription: { type: subscriptionSchema, default: () => ({}) },
    transactions: { type: [transactionSchema], default: [] },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model("User", userSchema);

/** Fields safe to return to the account owner or an admin. */
export function publicUser(user: {
  id?: string;
  _id?: unknown;
  name: string;
  email: string;
  company?: string | null;
  status?: string;
  createdAt?: Date;
  lastLoginAt?: Date | null;
  subscription?: any;
  transactions?: any[];
}) {
  return {
    id: user.id ?? String(user._id),
    name: user.name,
    email: user.email,
    company: user.company ?? null,
    status: user.status ?? "active",
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
    subscription: user.subscription ?? {
      planName: "Free Trial",
      planKind: "app",
      price: 0,
      period: "14 days",
      status: "trialing",
      startDate: user.createdAt ?? new Date(),
      renewsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      lookupsLimit: 50,
      lookupsUsed: 0,
      apiCallsLimit: 1000,
      apiCallsUsed: 0,
    },
    transactions: user.transactions ?? [],
  };
}
