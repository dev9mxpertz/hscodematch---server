import { Router } from "express";
import { Schema, model } from "mongoose";
import { z } from "zod";
import { notifyTeam } from "../../lib/mailer.js";
import { parse } from "../../lib/validate.js";
import { formLimiter } from "../../middleware/rate-limit.js";
import { SUBMISSION_STATUSES, honeypot, isSpam, submissionAdminRouter } from "./submission.js";

/* ---------- model ---------- */

const contactMessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    status: { type: String, enum: SUBMISSION_STATUSES, default: "new", index: true },
  },
  { timestamps: true },
);
contactMessageSchema.index({ createdAt: -1 });

export const ContactMessageModel = model("ContactMessage", contactMessageSchema);

/* ---------- validation ---------- */

export const createContactMessageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.email("Enter a valid email address").max(254),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(5000),
  ...honeypot,
});

/* ---------- routes ---------- */

/** POST /api/v1/contact — "Let's Talk" form */
export const contactPublicRouter = Router();

contactPublicRouter.post("/", formLimiter, async (req, res) => {
  const { website, ...input } = parse(createContactMessageSchema, req.body);
  if (isSpam({ website })) {
    res.status(201).json({ data: { received: true } });
    return;
  }

  const saved = await ContactMessageModel.create(input);
  await notifyTeam(`New contact message: ${input.subject}`, {
    Name: input.name,
    Email: input.email,
    Subject: input.subject,
    Message: input.message,
  });
  res.status(201).json({ data: { id: saved.id, received: true } });
});

/** /api/v1/admin/contact-messages */
export const contactAdminRouter = submissionAdminRouter(ContactMessageModel, [
  "name",
  "email",
  "subject",
  "message",
]);
