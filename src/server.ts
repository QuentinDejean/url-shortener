import { randomUUID } from "node:crypto";
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { Db } from "./db/client.js";
import { errorBody } from "./lib/errors.js";
import { healthRoutes } from "./routes/health.js";
import { linkRoutes } from "./routes/links.js";

export type AppDeps = { db: Db; logLevel?: string };

export function buildServer({ db, logLevel = "info" }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: { level: logLevel },
    genReqId: (req) => (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
    // Router-level failures (bad URL encoding, params over maxParamLength) bypass the
    // error/not-found handlers; serve the standard JSON 404 for them too.
    frameworkErrors: (error: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
      req.log.warn({ err: error }, "router error");
      return reply.code(404).send(errorBody("not_found", "Route not found"));
    },
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send(errorBody("validation_error", err.issues.map((i) => i.message).join("; ")));
    }
    if (err instanceof Error && "statusCode" in err && err.statusCode === 400) {
      return reply.code(400).send(errorBody("validation_error", err.message));
    }
    req.log.error({ err }, "unhandled error");
    return reply.code(500).send(errorBody("internal_error", "Something went wrong"));
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send(errorBody("not_found", "Route not found")));

  healthRoutes(app, db);
  linkRoutes(app, db);
  return app;
}
