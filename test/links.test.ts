import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertLink } from "../src/db/links.js";
import { generateCode } from "../src/lib/code.js";
import { buildServer } from "../src/server.js";

vi.mock("../src/db/links.js", () => ({ insertLink: vi.fn() }));
vi.mock("../src/lib/code.js", () => ({ generateCode: vi.fn() }));

const insertLinkMock = vi.mocked(insertLink);
const generateCodeMock = vi.mocked(generateCode);

type LinkRow = { id: number; code: string; url: string };

beforeEach(() => {
  insertLinkMock.mockReset();
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

  it("returns 500 when the database fails unexpectedly", async () => {
    insertLinkMock.mockRejectedValue(new Error("connection refused"));
    const app = buildServer({ db: {} as never, logLevel: "silent" });

    const res = await app.inject({ method: "POST", url: "/links", payload: { url: "https://example.com/fail" } });

    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe("internal_error");
    await app.close();
  });
});
