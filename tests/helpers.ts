import request from "supertest";
import { createApp } from "../src/app.js";
import { upsertAdmin } from "../src/modules/auth/auth.service.js";

export const app = createApp();
export const api = () => request(app);

export const ADMIN = { email: "admin@example.com", password: "correct-horse-battery" };

/** Creates the admin and returns an Authorization header value. */
export async function adminAuth() {
  await upsertAdmin(ADMIN.email, ADMIN.password, "Test Admin");
  const res = await api().post("/api/v1/auth/login").send(ADMIN).expect(200);
  return `Bearer ${res.body.data.token as string}`;
}
