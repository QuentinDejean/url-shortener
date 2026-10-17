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
