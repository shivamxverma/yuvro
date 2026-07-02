import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import logger from "./logger";
import config from "../config";
import * as schema from "db-schema";

const { Pool } = pg;

function createDrizzle(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

type DrizzleDb = ReturnType<typeof createDrizzle>;

export let db: DrizzleDb;
let pool: pg.Pool | undefined;

export async function getDrizzleClient(): Promise<DrizzleDb> {
  if (db) return db;

  pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false,
  });

  pool.on("error", (err) => {
    logger.error("Unexpected error on idle PostgreSQL client", err);
  });

  db = createDrizzle(pool);
  logger.info("Database connection established successfully");
  return db;
}

export async function closeDatabaseConnection() {
  if (pool) {
    await pool.end();
    logger.info("Database connection closed");
  }
}
