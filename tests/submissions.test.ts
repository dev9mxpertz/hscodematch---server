import { describe, expect, it } from "vitest";
import { ContactMessageModel } from "../src/modules/submissions/contact-message.js";
import { ExpertInquiryModel } from "../src/modules/submissions/expert-inquiry.js";
import { SubscriberModel } from "../src/modules/submissions/subscriber.js";
import { adminAuth, api } from "./helpers.js";

const contact = {
  name: "Jane Roe",
  email: "Jane@Example.com",
  subject: "API pricing",
  message: "Do you offer volume discounts?",
};

describe("POST /api/v1/contact", () => {
  it("saves a valid message", async () => {
    const res = await api().post("/api/v1/contact").send(contact).expect(201);
    expect(res.body.data.received).toBe(true);

    const saved = await ContactMessageModel.findById(res.body.data.id).lean();
    expect(saved).toMatchObject({ name: "Jane Roe", email: "jane@example.com", status: "new" });
  });

  it("rejects invalid input with field errors", async () => {
    const res = await api()
      .post("/api/v1/contact")
      .send({ ...contact, email: "not-an-email", message: "" })
      .expect(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["email", "message"]));
  });

  it("silently drops honeypot spam", async () => {
    await api()
      .post("/api/v1/contact")
      .send({ ...contact, website: "http://spam.example" })
      .expect(201);
    expect(await ContactMessageModel.countDocuments()).toBe(0);
  });
});

describe("POST /api/v1/inquiries", () => {
  it("saves a valid inquiry", async () => {
    await api()
      .post("/api/v1/inquiries")
      .send({ name: "Jane", email: "j@a.co", type: "Partnerships", message: "Hello" })
      .expect(201);
    expect(await ExpertInquiryModel.countDocuments({ type: "Partnerships" })).toBe(1);
  });

  it("rejects an unknown inquiry type", async () => {
    await api()
      .post("/api/v1/inquiries")
      .send({ name: "Jane", email: "j@a.co", type: "Something else", message: "Hello" })
      .expect(400);
  });
});

describe("POST /api/v1/newsletter", () => {
  it("is idempotent for the same email", async () => {
    await api().post("/api/v1/newsletter").send({ email: "a@b.co" }).expect(201);
    await api().post("/api/v1/newsletter").send({ email: "A@B.co" }).expect(201);
    expect(await SubscriberModel.countDocuments()).toBe(1);
  });
});

describe("admin submissions", () => {
  it("requires a token", async () => {
    await api().get("/api/v1/admin/contact-messages").expect(401);
    await api()
      .get("/api/v1/admin/contact-messages")
      .set("Authorization", "Bearer nonsense")
      .expect(401);
  });

  it("lists, filters, updates and deletes contact messages", async () => {
    const auth = await adminAuth();
    await api().post("/api/v1/contact").send(contact).expect(201);
    await api()
      .post("/api/v1/contact")
      .send({ ...contact, subject: "Other topic" })
      .expect(201);

    const list = await api()
      .get("/api/v1/admin/contact-messages?q=pricing")
      .set("Authorization", auth)
      .expect(200);
    expect(list.body.meta.total).toBe(1);
    const id = list.body.data[0]._id;

    const updated = await api()
      .patch(`/api/v1/admin/contact-messages/${id}`)
      .set("Authorization", auth)
      .send({ status: "read" })
      .expect(200);
    expect(updated.body.data.status).toBe("read");

    const unread = await api()
      .get("/api/v1/admin/contact-messages?status=new")
      .set("Authorization", auth)
      .expect(200);
    expect(unread.body.meta.total).toBe(1);

    await api()
      .delete(`/api/v1/admin/contact-messages/${id}`)
      .set("Authorization", auth)
      .expect(204);
    await api().get(`/api/v1/admin/contact-messages/${id}`).set("Authorization", auth).expect(404);
    await api()
      .get("/api/v1/admin/contact-messages/not-an-id")
      .set("Authorization", auth)
      .expect(400);
  });

  it("exports subscribers as CSV", async () => {
    const auth = await adminAuth();
    await api().post("/api/v1/newsletter").send({ email: "a@b.co" }).expect(201);
    const res = await api()
      .get("/api/v1/admin/subscribers/export.csv")
      .set("Authorization", auth)
      .expect(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("a@b.co");
  });
});
