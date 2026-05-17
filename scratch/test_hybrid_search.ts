import { connectDatabase, DecisionRepository, disconnectDatabase } from "@opsmind/memory";
import { generateEmbedding } from "@opsmind/ai";
import { loadEnv } from "@opsmind/config";
import { createLogger } from "@opsmind/shared";

const logger = createLogger("TestHybridSearch");

async function runTest() {
  try {
    loadEnv();
    await connectDatabase();

    const queryText = "European churn crisis on Pro plan";
    logger.info(`Starting hybrid search test for query: "${queryText}"...`);

    // 1. Generate query embedding
    logger.info("Generating query embedding via Voyage AI/Gemini...");
    const embedding = await generateEmbedding(queryText, "query");

    if (!embedding) {
      logger.error("Failed to generate embedding for the search query.");
      return;
    }
    logger.info(`Embedding generated successfully. Dimension: ${embedding.length}`);

    // 2. Execute Hybrid Search (Vector + Text)
    const repo = new DecisionRepository();
    const results = await repo.searchHybrid(queryText, embedding, 5);

    logger.info(`Search completed. Found ${results.length} matched decisions.`);

    if (results.length === 0) {
      logger.warn("No decisions matched your query. Make sure decisions exist and have status 'finalized' and valid 1024-dimensional embeddings.");
    }

    results.forEach((res, i) => {
      console.log(`\n--- Result #${i + 1} ---`);
      console.log(`ID: ${res._id}`);
      console.log(`Goal: ${res.goal}`);
      console.log(`Summary: ${res.summary}`);
      console.log(`Status: ${res.status}`);
      console.log(`Match Type: ${res.searchType.toUpperCase()}`);
      console.log(`Normalized Score: ${res.searchScore.toFixed(4)}`);
    });

  } catch (error) {
    logger.error("Hybrid search test failed", error);
  } finally {
    await disconnectDatabase();
  }
}

runTest();
