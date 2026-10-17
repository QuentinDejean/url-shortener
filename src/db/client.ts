import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export function createDb(connectionString: string) {
  return drizzle({ client: new pg.Pool({ connectionString, max: 10 }), schema });
}

export type Db = ReturnType<typeof createDb>;
