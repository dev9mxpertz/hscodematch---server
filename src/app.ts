import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env, isTest } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { apiLimiter } from "./middleware/rate-limit.js";
import { apiRouter } from "./routes/index.js";

/** Builds the Express app without starting a server (used by tests too). */
export function createApp() {
  const app = express();

  // Behind Nginx / a load balancer: trust the first proxy so rate limits see real client IPs.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86_400,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  if (!isTest)
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/v1/health" } }));

  app.get("/", (_req, res) => {
    res.json({ name: "HSCodeMatch API", version: "v1", docs: "/api/v1/health" });
  });
  app.use("/api/v1", apiLimiter, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
