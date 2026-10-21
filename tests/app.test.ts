import { describe, expect, it } from "vitest";
import { ADMIN, adminAuth, api } from "./helpers.js";

describe("app", () => {
  it("reports health", async () => {
    const res = await api().get("/api/v1/health").expect(200);
    expect(res.body).toEqual({ status: "ok", database: "up" });
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await api().get("/api/v1/nope").expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects malformed JSON", async () => {
    const res = await api()
      .post("/api/v1/contact")
      .set("Content-Type", "application/json")
      .send("{not json")
      .expect(400);
    expect(res.body.error.message).toMatch(/JSON/);
  });

  it("sends CORS headers for allowed origins only", async () => {
    const allowed = await api().get("/api/v1/health").set("Origin", "http://localhost:3000");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");

    const blocked = await api().get("/api/v1/health").set("Origin", "https://evil.example");
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("auth", () => {
  it("rejects wrong credentials with a generic message", async () => {
    await adminAuth();
    const res = await api()
      .post("/api/v1/auth/login")
      .send({ email: ADMIN.email, password: "wrong-password" })
      .expect(401);
    expect(res.body.error.message).toBe("Incorrect email or password");

    await api()
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "whatever" })
      .expect(401);
  });

  it("returns the signed-in admin and never exposes the password hash", async () => {
    const auth = await adminAuth();
    const res = await api().get("/api/v1/auth/me").set("Authorization", auth).expect(200);
    expect(res.body.data).toMatchObject({ email: ADMIN.email, name: "Test Admin" });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });
});
