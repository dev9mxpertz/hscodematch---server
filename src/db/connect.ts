import mongoose from "mongoose";
import { logger } from "../lib/logger.js";

mongoose.set("strictQuery", true);

export async function connectDatabase(uri: string) {
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info({ db: mongoose.connection.name }, "MongoDB connected");
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export const isDatabaseReady = () => mongoose.connection.readyState === 1;
