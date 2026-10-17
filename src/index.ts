import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { buildServer } from "./server.js";

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const app = buildServer({ db, logLevel: config.LOG_LEVEL });

const shutdown = async () => {
  await app.close();
  await db.$client.end();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: config.PORT, host: "0.0.0.0" });
