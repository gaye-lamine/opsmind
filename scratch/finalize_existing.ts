import { connectDatabase, DecisionRepository, disconnectDatabase } from "@opsmind/memory";
import { loadEnv } from "@opsmind/config";
import { createLogger } from "@opsmind/shared";

const logger = createLogger("FinalizeMigration");

async function main() {
  try {
    loadEnv();
    await connectDatabase();

    const repo = new DecisionRepository();
    const collection = await repo.getCollection();

    logger.info("Connecting to MongoDB Atlas and updating historical decisions...");
    const result = await collection.updateMany(
      { status: "reflected" },
      { $set: { status: "finalized", updatedAt: new Date() } }
    );

    logger.info(`Migration complete! Successfully finalized ${result.modifiedCount} decisions.`);
  } catch (error) {
    logger.error("Migration failed", error);
  } finally {
    await disconnectDatabase();
  }
}

main();
