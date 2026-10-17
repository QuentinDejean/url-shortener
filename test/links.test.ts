import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findLinkByCode, insertLink } from "../src/db/links.js";
import { generateCode } from "../src/lib/code.js";
import { buildServer } from "../src/server.js";

vi.mock("../src/db/links.js", () => ({ insertLink: vi.fn(), findLinkByCode: vi.fn() }));
vi.mock("../src/lib/code.js", () => ({ generateCode: vi.fn() }));

const insertLinkMock = vi.mocked(insertLink);
const findLinkByCodeMock = vi.mocked(findLinkByCode);
const generateCodeMock = vi.mocked(generateCode);

type LinkRow = { id: number; code: string; url: string };

beforeEach(() => {
  insertLinkMock.mockReset();
  findLinkByCodeMock.mockReset();
  // Deterministic, unique-per-call codes keep assertions exact (no reliance on random draws).
  let n = 0;
  generateCodeMock.mockImplementation(() => `code${String(n++).padStart(3, "0")}`);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function mockStore() {
  const rows: LinkRow[] = [];
  insertLinkMock.mockImplementation(async (_db, { code, url }) => {
    if (rows.some((row) => row.code === code)) return null;
    const row: LinkRow = { id: rows.length + 1, code, url };
    rows.push(row);
    return row;
  });
  return rows;
}

describe("POST /links (stubbed DB)", () => {
  it("returns 201 with the created link and stores it", async () => {
    const rows = mockStore();
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    const res = await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com/very/long/path" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toEqual({ id: 1, code: body.code, url: "https://example.com/very/long/path" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.url).toBe("https://example.com/very/long/path");
    expect(rows[0]?.code).toMatch(/^[0-9A-Za-z]{7}$/);
    await app.close();
  });

  it("returns 400 when the body is missing or malformed", async () => {
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    const empty = await app.inject({ method: "POST", url: "/links", payload: {} });
    const badJson = await app.inject({
      method: "POST",
      url: "/links",
      payload: "not json",
      headers: { "content-type": "application/json" },
    });
    const wrongType = await app.inject({ method: "POST", url: "/links", payload: { url: 42 } });

    for (const res of [empty, badJson, wrongType]) {
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("validation_error");
    }
    await app.close();
  });

  it("returns 400 for a URL that is not an absolute http(s) URL", async () => {
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    for (const url of ["not-a-url", "ftp://example.com/file", "//example.com/page", "https://"]) {
      const res = await app.inject({ method: "POST", url: "/links", payload: { url } });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("validation_error");
    }
    await app.close();
  });

  it("returns 400 for a URL longer than 2048 characters", async () => {
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    const res = await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: `https://example.com/${"a".repeat(2048)}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("validation_error");
    await app.close();
  });

  it("retries with a new code when the code already exists", async () => {
    const rows: LinkRow[] = [];
    let calls = 0;
    insertLinkMock.mockImplementation(async (_db, { code, url }) => {
      calls++;
      if (calls === 1) return null; // first generated code collides
      const row: LinkRow = { id: 1, code, url };
      rows.push(row);
      return row;
    });
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    const res = await app.inject({ method: "POST", url: "/links", payload: { url: "https://example.com/retry" } });

    expect(res.statusCode).toBe(201);
    expect(calls).toBe(2);
    expect(insertLinkMock.mock.calls[1]?.[1].code).toBe("code001");
    await app.close();
  });

  it("returns 500 after exhausting the three code attempts", async () => {
    insertLinkMock.mockResolvedValue(null);
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    const res = await app.inject({ method: "POST", url: "/links", payload: { url: "https://example.com/collide" } });

    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe("internal_error");
    expect(insertLinkMock).toHaveBeenCalledTimes(3);
    await app.close();
  });

  it("normalizes non-ASCII URLs to their percent-encoded href before storing", async () => {
    const rows = mockStore();
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    const res = await app.inject({ method: "POST", url: "/links", payload: { url: "https://example.com/你好" } });

    expect(res.statusCode).toBe(201);
    expect(res.json().url).toBe("https://example.com/%E4%BD%A0%E5%A5%BD");
    expect(rows[0]?.url).toBe("https://example.com/%E4%BD%A0%E5%A5%BD");
    await app.close();
  });

  it("returns 400 when the normalized URL exceeds 2048 characters", async () => {
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    // 300 CJK chars percent-encode to ~2700 chars, over the limit even though the raw input is under it.
    const res = await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: `https://example.com/${"你".repeat(300)}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("validation_error");
    await app.close();
  });

  it("returns 500 when the database fails unexpectedly", async () => {
    insertLinkMock.mockRejectedValue(new Error("connection refused"));
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    const res = await app.inject({ method: "POST", url: "/links", payload: { url: "https://example.com/fail" } });

    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe("internal_error");
    await app.close();
  });
});

describe("GET /links/:code (stubbed DB)", () => {
  it("redirects 302 to the stored URL", async () => {
    findLinkByCodeMock.mockResolvedValue({ id: 1, code: "AbC123x", url: "https://example.com/target" });
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    const res = await app.inject({ method: "GET", url: "/links/AbC123x" });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://example.com/target");
    expect(res.body).toBe("");
    expect(findLinkByCodeMock).toHaveBeenCalledWith(expect.anything(), "AbC123x");
    await app.close();
  });

  it("returns 404 not_found for an unknown code", async () => {
    findLinkByCodeMock.mockResolvedValue(null);
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    const res = await app.inject({ method: "GET", url: "/links/zzzzzzz" });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
    await app.close();
  });

  it("returns 404 for a malformed code without touching the database", async () => {
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    for (const code of ["way-too-long-code", "bad-code!", "../etc"]) {
      const res = await app.inject({ method: "GET", url: `/links/${encodeURIComponent(code)}` });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe("not_found");
    }
    expect(findLinkByCodeMock).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns the standard 404 for router-level rejections: over-length and bad percent-encoding", async () => {
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    // 101 alphanumeric chars exceed Fastify's maxParamLength (would be 414 by default)...
    const tooLong = await app.inject({ method: "GET", url: `/links/${"a".repeat(101)}` });
    // ...and invalid percent-encoding is a router-level bad-URL error (would be 400 by default).
    const badEncoding = await app.inject({ method: "GET", url: "/links/%ZZ" });

    for (const res of [tooLong, badEncoding]) {
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe("not_found");
    }
    expect(findLinkByCodeMock).not.toHaveBeenCalled();
    await app.close();
  });

  it("does not break GET /health", async () => {
    const db = { execute: async () => ({ rows: [] }) } as never;
    const app = buildServer({ db, logLevel: "silent" });

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", db: "ok" });
    await app.close();
  });
});
