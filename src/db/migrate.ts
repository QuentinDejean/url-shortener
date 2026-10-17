import { join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadConfig } from "../config.js";
import { createDb } from "./client.js";

const db = createDb(loadConfig().DATABASE_URL);

try {
  await migrate(db, { migrationsFolder: join(import.meta.dirname, "../../migrations") });
  console.log("migrations up to date");
} finally {
  await db.$client.end();
}
