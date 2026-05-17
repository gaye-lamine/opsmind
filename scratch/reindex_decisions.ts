import { connectDatabase, DecisionRepository, disconnectDatabase } from "@opsmind/memory";
import { generateEmbedding } from "@opsmind/ai";
import { loadEnv } from "@opsmind/config";
import { createLogger } from "@opsmind/shared";

const logger = createLogger("ReindexScript");

async function reindex() {
  try {
    loadEnv();
    await connectDatabase();
    
    const repo = new DecisionRepository();
    const decisions = await repo.findMany({});
    
    logger.info(`Found ${decisions.length} decisions to check...`);
    
    const expectedDimensions = 1024;
    let updatedCount = 0;
    for (const decision of decisions) {
      if (!decision.embedding || decision.embedding.length !== expectedDimensions) {
        logger.info(`Regenerating embedding for decision: ${decision._id} (dimensions mismatch or missing)...`);
        const text = `${decision.goal} ${decision.summary}`;
        const embedding = await generateEmbedding(text, "document");
        
        if (embedding) {
          await repo.saveEmbedding(decision._id, embedding);
          updatedCount++;
          logger.info("Sleeping 22 seconds to respect Voyage AI free tier 3 RPM limit...");
          await new Promise((resolve) => setTimeout(resolve, 22000));
        }
      }
    }
    
    logger.info(`Re-indexing complete. Updated ${updatedCount} decisions.`);
  } catch (error) {
    logger.error("Re-indexing failed", error);
  } finally {
    await disconnectDatabase();
  }
}

reindex();
