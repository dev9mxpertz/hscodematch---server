import { Router } from "express";
import { isDatabaseReady } from "../db/connect.js";
import { revalidateOnChange } from "../lib/revalidate.js";
import { requireAdmin } from "../middleware/auth.js";
import { statsRouter } from "../modules/admin/stats.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { faqAdminRouter, faqPublicRouter } from "../modules/content/faq.js";
import { pageAdminRouter, pagePublicRouter } from "../modules/content/page.js";
import { planAdminRouter, planPublicRouter } from "../modules/content/plan.js";
import { postAdminRouter, postPublicRouter } from "../modules/content/post.js";
import { serviceAdminRouter, servicePublicRouter } from "../modules/content/service.js";
import { settingsAdminRouter, settingsPublicRouter } from "../modules/content/setting.js";
import { testimonialAdminRouter, testimonialPublicRouter } from "../modules/content/testimonial.js";
import { contactAdminRouter, contactPublicRouter } from "../modules/submissions/contact-message.js";
import { inquiryAdminRouter, inquiryPublicRouter } from "../modules/submissions/expert-inquiry.js";
import {
  newsletterPublicRouter,
  subscriberAdminRouter,
} from "../modules/submissions/subscriber.js";
import { accountRouter, userAdminRouter } from "../modules/users/account.routes.js";

/* ---------- public ---------- */

const publicRouter = Router();
publicRouter.use("/contact", contactPublicRouter);
publicRouter.use("/inquiries", inquiryPublicRouter);
publicRouter.use("/newsletter", newsletterPublicRouter);
publicRouter.use("/posts", postPublicRouter);
publicRouter.use("/plans", planPublicRouter);
publicRouter.use("/services", servicePublicRouter);
publicRouter.use("/faqs", faqPublicRouter);
publicRouter.use("/testimonials", testimonialPublicRouter);
publicRouter.use("/pages", pagePublicRouter);
publicRouter.use("/settings", settingsPublicRouter);
publicRouter.use("/auth", authRouter); // admin sign-in
publicRouter.use("/account", accountRouter); // website visitor accounts

/* ---------- admin (JWT required) ---------- */

const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.use("/stats", statsRouter);
adminRouter.use("/users", userAdminRouter);
adminRouter.use("/contact-messages", contactAdminRouter);
adminRouter.use("/inquiries", inquiryAdminRouter);
adminRouter.use("/subscribers", subscriberAdminRouter);
// Website content: every saved change refreshes the public site.
adminRouter.use("/posts", revalidateOnChange, postAdminRouter);
adminRouter.use("/plans", revalidateOnChange, planAdminRouter);
adminRouter.use("/services", revalidateOnChange, serviceAdminRouter);
adminRouter.use("/faqs", revalidateOnChange, faqAdminRouter);
adminRouter.use("/testimonials", revalidateOnChange, testimonialAdminRouter);
adminRouter.use("/pages", revalidateOnChange, pageAdminRouter);
adminRouter.use("/settings", revalidateOnChange, settingsAdminRouter);

/* ---------- v1 ---------- */

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  const database = isDatabaseReady() ? "up" : "down";
  res
    .status(database === "up" ? 200 : 503)
    .json({ status: database === "up" ? "ok" : "degraded", database });
});
apiRouter.use("/admin", adminRouter);
apiRouter.use(publicRouter);
