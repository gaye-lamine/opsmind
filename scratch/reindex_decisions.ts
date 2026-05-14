import { connectDatabase, DecisionRepository, disconnectDatabase } from "../packages/memory/src/index";
import { generateEmbedding } from "../packages/ai/src/index";
import { loadEnv } from "../packages/config/src/index";
import { createLogger } from "../packages/shared/src/index";

const logger = createLogger("ReindexScript");

async function reindex() {
  try {
    loadEnv();
    await connectDatabase();
    
    const repo = new DecisionRepository();
    const decisions = await repo.findMany({});
    
    logger.info(`Found ${decisions.length} decisions to check...`);
    
    let updatedCount = 0;
    for (const decision of decisions) {
      if (!decision.embedding || decision.embedding.length === 0) {
        logger.info(`Generating embedding for decision: ${decision._id}...`);
        const text = `${decision.goal} ${decision.summary}`;
        const embedding = await generateEmbedding(text);
        
        if (embedding) {
          await repo.saveEmbedding(decision._id, embedding);
          updatedCount++;
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
