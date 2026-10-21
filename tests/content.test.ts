import { beforeEach, describe, expect, it } from "vitest";
import { PostModel } from "../src/modules/content/post.js";
import { seedContent } from "../src/seed/seed-content.js";
import { adminAuth, api } from "./helpers.js";

beforeEach(async () => {
  await seedContent();
});

describe("public content", () => {
  it("lists published posts, newest first, 6 per page", async () => {
    const res = await api().get("/api/v1/posts").expect(200);
    expect(res.body.data).toHaveLength(6);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 6, total: 14, totalPages: 3 });
    const dates = res.body.data.map((p: { publishedAt: string }) => p.publishedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(res.body.data[0].body).toBeUndefined();
  });

  it("filters posts by category and search text", async () => {
    const byCategory = await api().get("/api/v1/posts?category=Case Studies").expect(200);
    expect(byCategory.body.meta.total).toBe(2);

    const bySearch = await api().get("/api/v1/posts?q=tariff").expect(200);
    expect(bySearch.body.meta.total).toBeGreaterThan(0);
    for (const post of bySearch.body.data) {
      expect(`${post.title} ${post.excerpt} ${post.label}`.toLowerCase()).toContain("tariff");
    }
  });

  it("returns a post with related posts, and hides drafts", async () => {
    const res = await api().get("/api/v1/posts/gri-rules-explained").expect(200);
    expect(res.body.data.title).toMatch(/General Rules/);
    expect(res.body.data.related.length).toBeGreaterThan(0);

    await PostModel.updateOne({ slug: "gri-rules-explained" }, { status: "draft" });
    await api().get("/api/v1/posts/gri-rules-explained").expect(404);
  });

  it("returns plans by kind in display order", async () => {
    const res = await api().get("/api/v1/plans?kind=api").expect(200);
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual([
      "Sandbox",
      "Developer",
      "Growth",
      "Enterprise",
    ]);
  });

  it("returns FAQs for a page and services by category", async () => {
    const faqs = await api().get("/api/v1/faqs?page=pricing").expect(200);
    expect(faqs.body.data).toHaveLength(6);

    const services = await api().get("/api/v1/services?category=Developer API").expect(200);
    expect(services.body.data).toHaveLength(2);

    await api().get("/api/v1/faqs?page=nowhere").expect(400);
  });

  it("re-running the seed does not duplicate content", async () => {
    await seedContent();
    expect(await PostModel.countDocuments()).toBe(14);
  });
});

describe("admin content management", () => {
  it("creates, updates and deletes a post", async () => {
    const auth = await adminAuth();
    const post = {
      slug: "new-article",
      title: "New article",
      excerpt: "Short summary",
      category: "Customs Law",
      label: "Customs Law",
      tone: "green",
      image: "/blog/port.jpg",
      status: "published",
    };

    const created = await api()
      .post("/api/v1/admin/posts")
      .set("Authorization", auth)
      .send(post)
      .expect(201);
    const id = created.body.data._id;

    await api().post("/api/v1/admin/posts").set("Authorization", auth).send(post).expect(409);
    await api()
      .post("/api/v1/admin/posts")
      .set("Authorization", auth)
      .send({ ...post, slug: "Bad Slug!" })
      .expect(400);

    const updated = await api()
      .patch(`/api/v1/admin/posts/${id}`)
      .set("Authorization", auth)
      .send({ title: "Renamed" })
      .expect(200);
    expect(updated.body.data.title).toBe("Renamed");

    await api().get("/api/v1/posts/new-article").expect(200);
    await api().delete(`/api/v1/admin/posts/${id}`).set("Authorization", auth).expect(204);
    await api().get("/api/v1/posts/new-article").expect(404);
  });

  it("lists drafts only for admins", async () => {
    const auth = await adminAuth();
    await PostModel.updateOne({ slug: "gri-rules-explained" }, { status: "draft" });
    const res = await api()
      .get("/api/v1/admin/posts?status=draft")
      .set("Authorization", auth)
      .expect(200);
    expect(res.body.meta.total).toBe(1);
  });
});
