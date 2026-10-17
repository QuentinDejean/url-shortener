import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { links } from "./schema.js";

export type Link = {
  id: number;
  code: string;
  url: string;
};

/** Insert a link; returns the created row, or null when the code already exists (conflict does nothing). */
export async function insertLink(db: Db, link: { code: string; url: string }): Promise<Link | null> {
  const rows = await db.insert(links).values(link).onConflictDoNothing().returning({
    id: links.id,
    code: links.code,
    url: links.url,
  });
  return rows[0] ?? null;
}

/** Fetch a link by its short code; returns null when no row matches. */
export async function findLinkByCode(db: Db, code: string): Promise<Link | null> {
  const rows = await db
    .select({ id: links.id, code: links.code, url: links.url })
    .from(links)
    .where(eq(links.code, code))
    .limit(1);
  return rows[0] ?? null;
}
