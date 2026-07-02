import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import config from "./config";

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
});

const db = drizzle(pool);

async function main() {
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied successfully!");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  pool.end();
  process.exit(1);
});
