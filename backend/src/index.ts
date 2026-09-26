import "dotenv/config";
import app from "./app";
import { prisma } from "./config/db";
import { logger } from "./utils/logger";

const PORT = Number.parseInt(process.env.PORT || "4000", 10);

const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info("server.started", { port: PORT, environment: process.env.NODE_ENV || "development" });
  // Do not stop the API if the database is briefly unavailable. Record the
  // condition instead, and let the shared error handler return a safe message.
  void prisma.$connect()
    .then(() => logger.info("database.connected"))
    .catch((error) => logger.error("database.connection_failed", error));
});

async function shutdown(signal: string) {
  logger.info("server.shutting_down", { signal });
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("server.stopped", { signal });
    process.exit(0);
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error("process.unhandled_rejection", reason));
process.on("uncaughtException", (error) => {
  logger.error("process.uncaught_exception", error);
  void shutdown("uncaughtException");
});
