import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/url_shortener",
      LOG_LEVEL: "silent",
    },
  },
});
