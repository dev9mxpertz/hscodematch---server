import { Router } from "express";
import { Schema, model } from "mongoose";
import { z } from "zod";
import { parse } from "../../lib/validate.js";

/**
 * Site-wide settings: links, contact details, offices, social links and the
 * homepage hero highlights/stats. Stored as a single document (key "site").
 */

/* ---------- validation ---------- */

const text = (max = 300) => z.string().trim().max(max);
const url = z.string().trim().max(1000);

export const settingsSchema = z.object({
  links: z.object({ app: url, demoVideo: url }),
  contact: z.object({
    email: z.email(),
    supportEmail: z.email(),
    responseTime: text(),
    officeDays: text(80),
    officeTime: text(80),
  }),
  headOffice: z.object({
    name: text(80),
    address: text(),
    shortAddress: text(),
    hours: text(120),
    mapEmbedUrl: url,
  }),
  /** Second office, shown on the support page. */
  secondOffice: text(),
  /** Extra address line under the office on contact cards. */
  addressNote: text(),
  socials: z.object({ linkedin: url, instagram: url, x: url }),
  home: z.object({
    highlights: z.array(text(60)).max(5),
    stats: z.array(z.object({ value: text(20).min(1), label: text(60).min(1) })).max(6),
  }),
});

export type SiteSettings = z.infer<typeof settingsSchema>;

/* ---------- model ---------- */

const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, minimize: false },
);

export const SettingModel = model("Setting", settingSchema);

const SITE = "site";

export async function getSiteSettings() {
  const doc = await SettingModel.findOne({ key: SITE }).lean();
  return (doc?.value as SiteSettings | undefined) ?? null;
}

export async function saveSiteSettings(value: SiteSettings) {
  await SettingModel.updateOne({ key: SITE }, { $set: { value } }, { upsert: true });
  return value;
}

/* ---------- routes ---------- */

/** GET /api/v1/settings */
export const settingsPublicRouter = Router();

settingsPublicRouter.get("/", async (_req, res) => {
  res.json({ data: await getSiteSettings() });
});

/** GET / PUT /api/v1/admin/settings */
export const settingsAdminRouter = Router();

settingsAdminRouter.get("/", async (_req, res) => {
  res.json({ data: await getSiteSettings() });
});

settingsAdminRouter.put("/", async (req, res) => {
  res.json({ data: await saveSiteSettings(parse(settingsSchema, req.body)) });
});
