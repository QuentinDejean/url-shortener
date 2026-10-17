import { sql } from "drizzle-orm";
import { bigint, check, pgTable, text, varchar } from "drizzle-orm/pg-core";

export const links = pgTable(
  "links",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    code: varchar("code", { length: 10 }).notNull().unique(),
    url: text("url").notNull(),
  },
  (table) => [check("links_url_max_length", sql`char_length(${table.url}) <= 2048`)],
);
