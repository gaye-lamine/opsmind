const { MongoClient } = require('mongodb');
const { randomUUID } = require('crypto');

const MONGODB_URI = "mongodb+srv://lamineg049_db_user:FCOE4xmVMhWjnFz0@opsmind.2ylt0ve.mongodb.net/?retryWrites=true&w=majority&appName=opsmind";
const DATABASE_NAME = "opsmind";

async function seed() {
  console.log("🚀 Seeding historical decisions (Standalone JS)...");
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection("decisions");

    const historicalDecisions = [
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

    const result = await collection.insertMany(historicalDecisions);
    console.log(`✅ Successfully seeded ${result.insertedCount} historical decisions.`);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await client.close();
  }
}

seed();
