import { connectDatabase, DecisionRepository, disconnectDatabase } from "../packages/memory/src/index";
import { loadEnv } from "../packages/config/src/index";
import { randomUUID } from "crypto";

async function seed() {
  console.log("🚀 Seeding historical decisions using internal repositories...");
  
  try {
    // 1. Initialize environment and connection
    loadEnv();
    await connectDatabase();
    const repo = new DecisionRepository();

    const historicalDecisions: any[] = [
      {
        _id: `decision_${randomUUID()}`,
        sessionId: `session_${randomUUID()}`,
        goal: "Investigate checkout error spike",
        category: "anomaly_resolution",
        summary: "Historical checkout failure caused by Stripe API timeout.",
        reasoning: "Analysis of logs showed high latency in payment gateway calls.",
        findings: [
          {
            id: randomUUID(),
            title: "Third-party API Latency",
            description: "Stripe production API experienced 5s latency.",
            severity: "critical",
            type: "technical"
          }
        ],
        recommendations: [
          {
            id: randomUUID(),
            title: "Switch to secondary payment provider",
            priority: "immediate",
            status: "completed"
          }
        ],
        confidenceScore: 0.92,
        status: "finalized",
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      },
      {
        _id: `decision_${randomUUID()}`,
        sessionId: `session_${randomUUID()}`,
        goal: "Analyze conversion drop",
        category: "business_analysis",
        summary: "Conversion drop due to broken CSS on mobile checkout page.",
        reasoning: "Visual regression tools flagged layout shift in Safari iOS.",
        findings: [
          {
            id: randomUUID(),
            title: "UI Regression",
            description: "Checkout button was hidden by overlapping banner.",
            severity: "high",
            type: "technical"
          }
        ],
        recommendations: [
          {
            id: randomUUID(),
            title: "Rollback frontend deployment",
            priority: "immediate",
            status: "completed"
          }
        ],
        confidenceScore: 0.88,
        status: "finalized",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    ];

    for (const doc of historicalDecisions) {
       // Using raw collection to bypass strict Zod validation if needed for seeding
       await (repo as any).collection.insertOne(doc);
    }
    
    console.log(`✅ Successfully seeded ${historicalDecisions.length} historical decisions.`);
    console.log("\n⚠️  Now run: npx ts-node scratch/reindex_decisions.ts");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await disconnectDatabase();
  }
}

seed();
