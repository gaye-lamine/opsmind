/**
 * OpsMind — Seed Script (standalone)
 *
 * Seeds MongoDB with an initial operational state snapshot so the dashboard
 * has data to display immediately on first run.
 *
 * This script is intentionally standalone — it uses mongodb and dotenv directly
 * without importing workspace packages, so it works before any build step.
 *
 * Usage:
 *   npx tsx scripts/seed-operational-state.ts
 *
 * Requires MONGODB_URI in .env
 */

import { MongoClient, type Db } from "mongodb";
import { config as loadDotenv } from "dotenv";
import { resolve } from "path";
import { randomUUID } from "crypto";

// Load .env from monorepo root (two levels up from scripts/)
loadDotenv({ path: resolve(__dirname, "../.env") });
// Fallback: try cwd
loadDotenv({ path: resolve(process.cwd(), ".env"), override: false });

const MONGODB_URI = process.env["MONGODB_URI"];
const MONGODB_DB_NAME = process.env["MONGODB_DB_NAME"] ?? "opsmind";

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set in .env");
  process.exit(1);
}

function generateId(): string {
  return randomUUID();
}

async function seed(): Promise<void> {
  console.log("🌱 Seeding OpsMind operational state...");
  console.log(`   Database: ${MONGODB_DB_NAME}`);

  const client = new MongoClient(MONGODB_URI as string);
  await client.connect();
  const db: Db = client.db(MONGODB_DB_NAME);

  const stateCollection = db.collection("operational_state");

  // Check if current state already exists
  const existing = await stateCollection.findOne({ isCurrent: true });
  if (existing) {
    console.log("✅ Operational state already exists — skipping seed");
    await client.close();
    return;
  }

  const now = new Date();

  const seedState = {
    _id: generateId(),
    snapshotAt: now,
    isCurrent: true,
    source: "seed",
    summary:
      "Initial operational state. Business metrics are being tracked. " +
      "Customer acquisition costs show a significant anomaly (+37% WoW). " +
      "Run an investigation to analyze root causes and generate strategic decisions.",
    metrics: [
      {
        name: "monthly_revenue",
        value: 127_400,
        unit: "USD",
        trend: "up",
        changePercent: 8.3,
        period: "MTD",
        isAnomaly: false,
      },
      {
        name: "customer_acquisition_cost",
        value: 127,
        unit: "USD",
        trend: "up",
        changePercent: 37.2,
        period: "WoW",
        isAnomaly: true,
        baseline: { mean: 92.5, stdDev: 12.3, sampleSize: 12 },
      },
      {
        name: "monthly_active_users",
        value: 4_820,
        unit: "users",
        trend: "stable",
        changePercent: 1.2,
        period: "MoM",
        isAnomaly: false,
      },
      {
        name: "churn_rate",
        value: 4.8,
        unit: "%",
        trend: "up",
        changePercent: 12.5,
        period: "MoM",
        isAnomaly: false,
      },
      {
        name: "conversion_rate",
        value: 2.3,
        unit: "%",
        trend: "down",
        changePercent: -11.5,
        period: "WoW",
        isAnomaly: true,
        baseline: { mean: 2.8, stdDev: 0.3, sampleSize: 8 },
      },
      {
        name: "average_revenue_per_user",
        value: 26.4,
        unit: "USD",
        trend: "stable",
        changePercent: 0.8,
        period: "MoM",
        isAnomaly: false,
      },
      {
        name: "support_ticket_volume",
        value: 143,
        unit: "tickets",
        trend: "up",
        changePercent: 22.4,
        period: "WoW",
        isAnomaly: false,
      },
    ],
    anomalies: [
      {
        id: generateId(),
        metric: "customer_acquisition_cost",
        description:
          "CAC increased 37.2% week-over-week to $127, significantly above the " +
          "12-week baseline of $92.50. This represents a 2.8 standard deviation event.",
        severity: "high",
        status: "detected",
        detectedAt: now,
        evidence: [
          "CAC: $127 vs baseline $92.50 (+37.2%)",
          "Deviation: 2.8σ above mean",
          "Trend: 3 consecutive weeks of increase",
        ],
        deviationMagnitude: 2.8,
      },
      {
        id: generateId(),
        metric: "conversion_rate",
        description:
          "Conversion rate dropped 11.5% week-over-week to 2.3%, below the " +
          "8-week baseline of 2.8%. Correlated with CAC increase — may indicate " +
          "campaign quality degradation.",
        severity: "medium",
        status: "detected",
        detectedAt: now,
        evidence: [
          "Conversion rate: 2.3% vs baseline 2.8% (-11.5%)",
          "Correlated with CAC spike",
          "Paid search channel most affected",
        ],
        deviationMagnitude: 1.7,
      },
    ],
    activeInvestigations: [],
  };

  await stateCollection.insertOne(seedState);

  // Create indexes
  await Promise.all([
    stateCollection.createIndex({ isCurrent: 1 }),
    stateCollection.createIndex({ snapshotAt: -1 }),
    db.collection("decisions").createIndex({ status: 1, createdAt: -1 }),
    db.collection("decisions").createIndex({ category: 1, status: 1, createdAt: -1 }),
    db.collection("sessions").createIndex({ status: 1, startedAt: -1 }),
    db.collection("actions").createIndex({ status: 1, priority: 1, createdAt: -1 }),
    db.collection("execution_logs").createIndex({ sessionId: 1, timestamp: 1 }),
  ]);

  console.log("✅ Operational state seeded successfully");
  console.log(`   Metrics: ${seedState.metrics.length}`);
  console.log(`   Anomalies: ${seedState.anomalies.length}`);
  console.log("");
  console.log("💡 Suggested first investigation:");
  console.log(
    '   "Customer acquisition costs increased by 37% this week. Investigate root causes and recommend actions."'
  );
  console.log("");
  console.log("🚀 Start the system:");
  console.log("   pnpm api   → http://localhost:3001");
  console.log("   pnpm web   → http://localhost:3000");

  await client.close();
}

seed().catch((err: unknown) => {
  console.error("❌ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
