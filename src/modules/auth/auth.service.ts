import { HttpError } from "../../lib/http-error.js";
import { checkPassword, hashPassword } from "../../lib/passwords.js";
import { signToken } from "../../lib/tokens.js";
import { AdminUserModel } from "./admin-user.model.js";

/** Checks admin credentials and returns a signed token. Same error for unknown email and bad password. */
export async function login(email: string, password: string) {
  const user = await AdminUserModel.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  const valid = await checkPassword(password, user?.passwordHash);
  if (!user || !valid) throw HttpError.unauthorized("Incorrect email or password");

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken({ sub: user.id, email: user.email }, "admin");
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

/** Creates the admin or resets the password if the email already exists. */
export async function upsertAdmin(email: string, password: string, name = "Administrator") {
  const passwordHash = await hashPassword(password);
  return AdminUserModel.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { passwordHash, name }, $setOnInsert: { email: email.toLowerCase() } },
    { upsert: true, returnDocument: "after" },
  );
}
