import { beforeEach, describe, expect, it } from "vitest";
import { PostModel } from "../src/modules/content/post.js";
import { seedContent } from "../src/seed/seed-content.js";
import { adminAuth, api } from "./helpers.js";

beforeEach(async () => {
  await seedContent();
});

describe("site settings", () => {
  it("are public and seeded with defaults", async () => {
    const res = await api().get("/api/v1/settings").expect(200);
    expect(res.body.data.contact.email).toBe("contact@hscodematch.com");
    expect(res.body.data.home.stats).toHaveLength(4);
  });

  it("can only be changed by an admin, with validation", async () => {
    const current = (await api().get("/api/v1/settings")).body.data;
    await api().put("/api/v1/admin/settings").send(current).expect(401);

    const auth = await adminAuth();
    const changed = { ...current, contact: { ...current.contact, email: "hello@example.com" } };
    await api().put("/api/v1/admin/settings").set("Authorization", auth).send(changed).expect(200);
    const res = await api().get("/api/v1/settings").expect(200);
    expect(res.body.data.contact.email).toBe("hello@example.com");

    const invalid = { ...current, contact: { ...current.contact, email: "not-an-email" } };
    const err = await api()
      .put("/api/v1/admin/settings")
      .set("Authorization", auth)
      .send(invalid)
      .expect(400);
    expect(err.body.error.details[0].field).toBe("contact.email");
  });

  it("are not overwritten by re-running the seed", async () => {
    const auth = await adminAuth();
    const current = (await api().get("/api/v1/settings")).body.data;
    await api()
      .put("/api/v1/admin/settings")
      .set("Authorization", auth)
      .send({ ...current, links: { ...current.links, app: "https://app.example.com" } })
      .expect(200);
    await seedContent();
    const res = await api().get("/api/v1/settings").expect(200);
    expect(res.body.data.links.app).toBe("https://app.example.com");
  });
});

describe("pages", () => {
  it("serves seeded pages by slug and lists them", async () => {
    const page = await api().get("/api/v1/pages/privacy").expect(200);
    expect(page.body.data.title).toBe("Privacy Policy");
    expect(page.body.data.body).toContain("## ");

    const list = await api().get("/api/v1/pages").expect(200);
    expect(list.body.data.map((p: { slug: string }) => p.slug)).toEqual([
      "about",
      "privacy",
      "terms",
    ]);
    await api().get("/api/v1/pages/missing").expect(404);
  });

  it("lets an admin add pages but not reuse website addresses", async () => {
    const auth = await adminAuth();
    await api()
      .post("/api/v1/admin/pages")
      .set("Authorization", auth)
      .send({ slug: "shipping-policy", title: "Shipping policy", body: "Text" })
      .expect(201);
    await api().get("/api/v1/pages/shipping-policy").expect(200);

    const res = await api()
      .post("/api/v1/admin/pages")
      .set("Authorization", auth)
      .send({ slug: "pricing", title: "Clash" })
      .expect(400);
    expect(res.body.error.details[0].field).toBe("slug");
  });

  it("hides unpublished pages", async () => {
    const auth = await adminAuth();
    const list = await api().get("/api/v1/admin/pages").set("Authorization", auth).expect(200);
    const about = list.body.data.find((p: { slug: string }) => p.slug === "about");
    await api()
      .patch(`/api/v1/admin/pages/${about._id}`)
      .set("Authorization", auth)
      .send({ published: false })
      .expect(200);
    await api().get("/api/v1/pages/about").expect(404);
  });
});

describe("seed", () => {
  it("keeps admin edits to existing content", async () => {
    await PostModel.updateOne({ slug: "gri-rules-explained" }, { title: "Edited title" });
    await seedContent();
    const post = await PostModel.findOne({ slug: "gri-rules-explained" }).lean();
    expect(post?.title).toBe("Edited title");
  });
});
