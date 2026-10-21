import { describe, expect, it } from "vitest";
import { requestPasswordReset } from "../src/modules/users/account.service.js";
import { UserModel } from "../src/modules/users/user.model.js";
import { adminAuth, api } from "./helpers.js";

const visitor = {
  name: "Priya Sharma",
  email: "Priya@Example.com",
  company: "Nova Retail",
  password: "secure-pass-123",
};

async function signUp() {
  const res = await api().post("/api/v1/account/signup").send(visitor).expect(201);
  return { token: res.body.data.token as string, user: res.body.data.user };
}

describe("visitor accounts", () => {
  it("signs up, signs in and reads the account", async () => {
    const { token, user } = await signUp();
    expect(user).toMatchObject({
      name: "Priya Sharma",
      email: "priya@example.com",
      company: "Nova Retail",
    });
    expect(JSON.stringify(user)).not.toContain("password");

    const signIn = await api()
      .post("/api/v1/account/signin")
      .send({ email: "priya@example.com", password: visitor.password })
      .expect(200);
    expect(signIn.body.data.token).toBeTruthy();

    const me = await api()
      .get("/api/v1/account/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(me.body.data.email).toBe("priya@example.com");
  });

  it("rejects duplicate emails and weak passwords", async () => {
    await signUp();
    await api().post("/api/v1/account/signup").send(visitor).expect(409);

    const weak = await api()
      .post("/api/v1/account/signup")
      .send({ ...visitor, email: "new@example.com", password: "short" })
      .expect(400);
    expect(weak.body.error.details[0].field).toBe("password");
  });

  it("rejects wrong passwords with a generic message", async () => {
    await signUp();
    const res = await api()
      .post("/api/v1/account/signin")
      .send({ email: visitor.email, password: "wrong-pass-123" })
      .expect(401);
    expect(res.body.error.message).toBe("Incorrect email or password");
  });

  it("updates the profile and changes the password", async () => {
    const { token } = await signUp();
    const auth = `Bearer ${token}`;

    const updated = await api()
      .patch("/api/v1/account/me")
      .set("Authorization", auth)
      .send({ company: "Nova Retail Ltd" })
      .expect(200);
    expect(updated.body.data.company).toBe("Nova Retail Ltd");

    await api()
      .post("/api/v1/account/change-password")
      .set("Authorization", auth)
      .send({ currentPassword: "nope", newPassword: "another-pass-456" })
      .expect(400);
    await api()
      .post("/api/v1/account/change-password")
      .set("Authorization", auth)
      .send({ currentPassword: visitor.password, newPassword: "another-pass-456" })
      .expect(200);
    await api()
      .post("/api/v1/account/signin")
      .send({ email: visitor.email, password: "another-pass-456" })
      .expect(200);
  });

  it("resets a forgotten password with a one-time link", async () => {
    await signUp();
    // Unknown emails get the same response, so accounts can't be discovered.
    await api()
      .post("/api/v1/account/forgot-password")
      .send({ email: "nobody@example.com" })
      .expect(200);

    const token = await requestPasswordReset(visitor.email);
    expect(token).toMatch(/^[a-f\d]{64}$/);

    await api()
      .post("/api/v1/account/reset-password")
      .send({ token, password: "brand-new-pass-789" })
      .expect(200);
    // The link only works once.
    await api()
      .post("/api/v1/account/reset-password")
      .send({ token, password: "brand-new-pass-789" })
      .expect(400);
    await api()
      .post("/api/v1/account/signin")
      .send({ email: visitor.email, password: "brand-new-pass-789" })
      .expect(200);
  });

  it("keeps visitor and admin tokens separate", async () => {
    const { token } = await signUp();
    await api().get("/api/v1/admin/stats").set("Authorization", `Bearer ${token}`).expect(401);

    const adminToken = await adminAuth();
    await api().get("/api/v1/account/me").set("Authorization", adminToken).expect(401);
  });
});

describe("admin user management and stats", () => {
  it("lists, disables and deletes visitor accounts", async () => {
    await signUp();
    const auth = await adminAuth();

    const list = await api()
      .get("/api/v1/admin/users?q=nova")
      .set("Authorization", auth)
      .expect(200);
    expect(list.body.meta.total).toBe(1);
    const id = list.body.data[0].id;

    await api()
      .patch(`/api/v1/admin/users/${id}`)
      .set("Authorization", auth)
      .send({ status: "disabled" })
      .expect(200);
    await api()
      .post("/api/v1/account/signin")
      .send({ email: visitor.email, password: visitor.password })
      .expect(403);

    await api().delete(`/api/v1/admin/users/${id}`).set("Authorization", auth).expect(204);
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it("reports dashboard counts", async () => {
    await signUp();
    await api()
      .post("/api/v1/contact")
      .send({ name: "A", email: "a@b.co", subject: "Hi", message: "Hello" })
      .expect(201);
    const auth = await adminAuth();

    const res = await api().get("/api/v1/admin/stats").set("Authorization", auth).expect(200);
    expect(res.body.data).toMatchObject({
      messages: { new: 1, total: 1 },
      users: { total: 1, last30Days: 1 },
    });
  });
});
