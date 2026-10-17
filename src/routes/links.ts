import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { insertLink } from "../db/links.js";
import { generateCode } from "../lib/code.js";
import { errorBody } from "../lib/errors.js";

const createLinkBody = z.object({ url: z.url({ protocol: /^https?$/ }).max(2048) });
const MAX_CODE_ATTEMPTS = 3;

export function linkRoutes(app: FastifyInstance, db: Db): void {
  app.post("/links", async (req, reply) => {
    const { url } = createLinkBody.parse(req.body);

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateCode();
      const link = await insertLink(db, { code, url });
      if (link) {
        return reply.code(201).send({ id: link.id, code: link.code, url: link.url });
      }
      req.log.warn({ code }, "code collision, retrying");
    }

    return reply.code(500).send(errorBody("internal_error", "Failed to generate a unique code"));
  });
}
