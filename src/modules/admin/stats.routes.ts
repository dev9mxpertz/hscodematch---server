import { Router } from "express";
import { PostModel } from "../content/post.js";
import { ContactMessageModel } from "../submissions/contact-message.js";
import { ExpertInquiryModel } from "../submissions/expert-inquiry.js";
import { SubscriberModel } from "../submissions/subscriber.js";
import { UserModel } from "../users/user.model.js";

/** GET /api/v1/admin/stats — counts for the admin dashboard. */
export const statsRouter = Router();

statsRouter.get("/", async (_req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    newMessages,
    totalMessages,
    newInquiries,
    totalInquiries,
    subscribers,
    users,
    usersLast30Days,
    publishedPosts,
    draftPosts,
  ] = await Promise.all([
    ContactMessageModel.countDocuments({ status: "new" }),
    ContactMessageModel.countDocuments(),
    ExpertInquiryModel.countDocuments({ status: "new" }),
    ExpertInquiryModel.countDocuments(),
    SubscriberModel.countDocuments({ status: "subscribed" }),
    UserModel.countDocuments(),
    UserModel.countDocuments({ createdAt: { $gte: since } }),
    PostModel.countDocuments({ status: "published" }),
    PostModel.countDocuments({ status: "draft" }),
  ]);

  res.json({
    data: {
      messages: { new: newMessages, total: totalMessages },
      inquiries: { new: newInquiries, total: totalInquiries },
      subscribers,
      users: { total: users, last30Days: usersLast30Days },
      posts: { published: publishedPosts, drafts: draftPosts },
    },
  });
});
