import expressLoader from "./express";
import logger from "./logger";
import Express from "express";
import { getDrizzleClient } from "./postgres";

export default async ({
  expressApp,
}: {
  expressApp: Express.Application;
}): Promise<void> => {
  await getDrizzleClient();
  logger.info("🛡️  Database loaded  🛡️");
  
  expressLoader({ app: expressApp });
  logger.info("🛡️  Express loaded  🛡️");
  
  logger.info("🛡️  All modules loaded!  🛡️");
};
