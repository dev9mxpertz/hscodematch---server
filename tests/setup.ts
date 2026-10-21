import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";

// Must be set before src/config/env.ts is first imported by a test.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI ??= "mongodb://placeholder";
process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
process.env.LOG_LEVEL = "silent";
process.env.CORS_ORIGINS = "http://localhost:3000";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  // Build unique indexes before tests rely on them (duplicate-key checks).
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
});

afterEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
