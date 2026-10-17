import { describe, expect, it } from "vitest";
import { generateCode } from "../src/lib/code.js";

describe("generateCode", () => {
  it("generates 7-character Base62 codes", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateCode()).toMatch(/^[0-9A-Za-z]{7}$/);
    }
  });

  it("supports custom lengths and fits varchar(10)", () => {
    expect(generateCode(10)).toMatch(/^[0-9A-Za-z]{10}$/);
  });
});
