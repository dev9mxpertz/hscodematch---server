import { Schema, model, type InferSchemaType } from "mongoose";

const adminUserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export type AdminUser = InferSchemaType<typeof adminUserSchema>;
export const AdminUserModel = model("AdminUser", adminUserSchema);
