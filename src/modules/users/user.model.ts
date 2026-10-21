import { Schema, model, type InferSchemaType } from "mongoose";

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
}) {
  return {
    id: user.id ?? String(user._id),
    name: user.name,
    email: user.email,
    company: user.company ?? null,
    status: user.status ?? "active",
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}
