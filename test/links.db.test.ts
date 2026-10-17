import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "../src/db/client.js";
import { insertLink } from "../src/db/links.js";
import { links } from "../src/db/schema.js";
import { buildServer } from "../src/server.js";

const db = createDb(process.env.DATABASE_URL as string);
const app = buildServer({ db, logLevel: "silent" });

// Only rows this suite created are removed, so the suite is safe against a
// database that holds data from the running app or other test runs.
const createdIds: number[] = [];

afterAll(async () => {
  if (createdIds.length > 0) {
    await db.delete(links).where(inArray(links.id, createdIds));
  }
  await app.close();
  await db.$client.end();
});

describe("POST /links (real Postgres)", () => {
  it("creates a link end to end", async () => {
    const res = await app.inject({ method: "POST", url: "/links", payload: { url: "https://example.com/e2e" } });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.code).toMatch(/^[0-9A-Za-z]{7}$/);
    const stored = await db.select().from(links).where(eq(links.code, body.code));
    expect(stored).toHaveLength(1);
    expect(stored[0]?.url).toBe("https://example.com/e2e");
    createdIds.push(body.id);
  });

  it("does not insert a duplicate code: the unique constraint fires and on conflict does nothing", async () => {
    const code = randomUUID().replaceAll("-", "").slice(0, 7);
    const first = await insertLink(db, { code, url: "https://example.com/first" });
    const duplicate = await insertLink(db, { code, url: "https://example.com/duplicate" });

    expect(first).toMatchObject({ code, url: "https://example.com/first" });
    expect(duplicate).toBeNull();
    const stored = await db.select().from(links).where(eq(links.code, code));
    expect(stored).toHaveLength(1);
    if (first) createdIds.push(first.id);
  });

  it("redirects GET /links/:code to the stored URL and leaves the row unchanged", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com/redirect-me" },
    });
    expect(created.statusCode).toBe(201);
    const { id, code, url } = created.json();
    createdIds.push(id);

    const res = await app.inject({ method: "GET", url: `/links/${code}` });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://example.com/redirect-me");
    const stored = await db.select().from(links).where(eq(links.code, code));
    expect(stored).toEqual([{ id, code, url }]);
  });

  it("redirects a non-ASCII destination through its percent-encoded href", async () => {
    const created = await app.inject({ method: "POST", url: "/links", payload: { url: "https://example.com/你好" } });
    expect(created.statusCode).toBe(201);
    const { id, code } = created.json();
    createdIds.push(id);

    const res = await app.inject({ method: "GET", url: `/links/${code}` });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://example.com/%E4%BD%A0%E5%A5%BD");
  });
});
