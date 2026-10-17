import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { Db } from "./db/client.js";
import { errorBody } from "./lib/errors.js";
import { healthRoutes } from "./routes/health.js";

export type AppDeps = { db: Db; logLevel?: string };

export function buildServer({ db, logLevel = "info" }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: { level: logLevel },
    genReqId: (req) => (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send(errorBody("validation_error", err.issues.map((i) => i.message).join("; ")));
    }
    req.log.error({ err }, "unhandled error");
    return reply.code(500).send(errorBody("internal_error", "Something went wrong"));
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send(errorBody("not_found", "Route not found")));

  healthRoutes(app, db);
  return app;
}
