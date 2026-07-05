import expressLoader from "./express";
import logger from "./logger";
import Express from "express";

export default async ({
  expressApp,
}: {
  expressApp: Express.Application;
}): Promise<void> => {
  expressLoader({ app: expressApp });
  logger.info("🛡️  Express loaded  🛡️");
  
  logger.info("🛡️  All modules loaded!  🛡️");
};
