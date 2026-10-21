import { Router } from "express";
import { Schema, model } from "mongoose";
import { z } from "zod";
import { notifyTeam } from "../../lib/mailer.js";
import { parse } from "../../lib/validate.js";
import { formLimiter } from "../../middleware/rate-limit.js";
import { SUBMISSION_STATUSES, honeypot, isSpam, submissionAdminRouter } from "./submission.js";

export const INQUIRY_TYPES = [
  "API Access",
  "HS Code Classification",
  "Pricing & Plans",
  "Partnerships",
  "Technical Support",
] as const;

/* ---------- model ---------- */

const expertInquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    type: { type: String, required: true, enum: INQUIRY_TYPES, index: true },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    status: { type: String, enum: SUBMISSION_STATUSES, default: "new", index: true },
  },
  { timestamps: true },
);
expertInquirySchema.index({ createdAt: -1 });

export const ExpertInquiryModel = model("ExpertInquiry", expertInquirySchema);

/* ---------- validation ---------- */

export const createExpertInquirySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.email("Enter a valid email address").max(254),
  type: z.enum(INQUIRY_TYPES),
  message: z.string().trim().min(1, "Message is required").max(5000),
  ...honeypot,
});

/* ---------- routes ---------- */

/** POST /api/v1/inquiries — "Contact Our Experts" form */
export const inquiryPublicRouter = Router();

inquiryPublicRouter.post("/", formLimiter, async (req, res) => {
  const { website, ...input } = parse(createExpertInquirySchema, req.body);
  if (isSpam({ website })) {
    res.status(201).json({ data: { received: true } });
    return;
  }

  const saved = await ExpertInquiryModel.create(input);
  await notifyTeam(`New expert inquiry: ${input.type}`, {
    Name: input.name,
    Email: input.email,
    Type: input.type,
    Message: input.message,
  });
  res.status(201).json({ data: { id: saved.id, received: true } });
});

/** /api/v1/admin/inquiries */
export const inquiryAdminRouter = submissionAdminRouter(ExpertInquiryModel, [
  "name",
  "email",
  "type",
  "message",
]);
