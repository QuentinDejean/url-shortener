import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "../src/db/client.js";
import { buildServer } from "../src/server.js";

const db = createDb(process.env.DATABASE_URL as string);
const app = buildServer({ db, logLevel: "silent" });

afterAll(async () => {
  await app.close();
  await db.$client.end();
});

describe("GET /health", () => {
  it("returns 200 when the database is reachable", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", db: "ok" });
  });

  it("returns 503 when the database is unreachable", async () => {
    const badDb = createDb("postgres://nobody:wrong@127.0.0.1:1/none");
    const badApp = buildServer({ db: badDb, logLevel: "silent" });
    const res = await badApp.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe("db_unavailable");
    await badApp.close();
    await badDb.$client.end();
  });

  it("returns 404 JSON for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
  });
});
