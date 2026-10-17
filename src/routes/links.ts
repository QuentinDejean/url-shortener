import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { findLinkByCode, insertLink } from "../db/links.js";
import { generateCode } from "../lib/code.js";
import { errorBody } from "../lib/errors.js";

const createLinkBody = z.object({
  // Normalize to the canonical href (percent-encoded, absolute) so stored URLs are
  // always safe to emit as a Location header; the 2048 limit applies to what we store.
  url: z
    .url({ protocol: /^https?$/ })
    .transform((url) => new URL(url).href)
    .pipe(z.string().max(2048)),
});
const codeParam = z.string().regex(/^[0-9A-Za-z]{1,10}$/);
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

  app.get("/links/:code", async (req, reply) => {
    const parsed = codeParam.safeParse((req.params as { code: string }).code);
    if (!parsed.success) {
      // A wrong-shaped code is just "no such resource"; do not touch the database.
      return reply.code(404).send(errorBody("not_found", "Link not found"));
    }

    const link = await findLinkByCode(db, parsed.data);
    if (!link) {
      return reply.code(404).send(errorBody("not_found", "Link not found"));
    }

    return reply.redirect(link.url);
  });
}
