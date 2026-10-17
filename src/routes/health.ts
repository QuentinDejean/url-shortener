import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Db } from "../db/client.js";
import { errorBody } from "../lib/errors.js";

export function healthRoutes(app: FastifyInstance, db: Db): void {
  app.get("/health", async (req, reply) => {
    try {
      await db.execute(sql`select 1`);
      return reply.code(200).send({ status: "ok", db: "ok" });
    } catch (err) {
      req.log.error({ err }, "db health check failed");
      return reply.code(503).send(errorBody("db_unavailable", "Database is unreachable"));
    }
  });
}
