/// <reference path="../apps/api/node_modules/@types/node/index.d.ts" />
import { MongoClient } from "mongodb";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load env from project root (scratch is at root, so ../.env)
dotenv.config({ path: resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI;

async function seedEventData() {
  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI not found in .env! Check your configuration.");
    process.exit(1);
  }
  
  const connectionLog = MONGODB_URI.includes("mongodb+srv") 
    ? "MongoDB Atlas" 
    : "Local MongoDB";
    
  console.log(`🏗️ Building Granular Event Scenario...`);
  console.log(`🔗 Target: ${connectionLog}`);
  
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("opsmind");

    // 1. Clean up
    console.log("🧹 Cleaning old data...");
    await db.collection("users").deleteMany({});
    await db.collection("metrics").deleteMany({});

    // 2. Seed Users
    console.log("👥 Seeding 200 users...");
    const regions = ["Europe", "North America", "Asia"];
    const plans = ["Free", "Pro", "Enterprise"];
    const users = [];

    for (let i = 0; i < 200; i++) {
      const region = regions[Math.floor(Math.random() * regions.length)];
      const plan = plans[Math.floor(Math.random() * plans.length)];
      const userId = `user_${randomUUID()}`;
      
      users.push({
        userId: userId, 
        email: `user${i}@example.com`,
        region,
        plan,
        signupDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
      });
    }
    await (db.collection("users") as any).insertMany(users);

    // 3. Seed Events (Metrics)
    console.log("⚡ Generating 5000+ events with a targeted churn spike...");
    const events = [];
    const now = new Date();

    for (const user of users) {
      // Normal activity: sessions and conversions
      const sessionCount = 10 + Math.floor(Math.random() * 20);
      for (let s = 0; s < sessionCount; s++) {
        events.push({
          userId: user.userId,
          type: "session",
          timestamp: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        });
      }

      // THE ANOMALY: Targeted Churn
      const isTargetCohort = user.region === "Europe" && user.plan === "Pro";
      const churnProbability = isTargetCohort ? 0.85 : 0.05; // 85% churn for target cohort!

      if (Math.random() < churnProbability) {
        events.push({
          userId: user.userId,
          type: "churn",
          timestamp: isTargetCohort 
            ? new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Recent spike
            : new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Baseline
        });
      }
    }
    
    // Batch insert for performance
    const chunkSize = 1000;
    for (let i = 0; i < events.length; i += chunkSize) {
      await (db.collection("metrics") as any).insertMany(events.slice(i, i + chunkSize));
    }

    console.log(`\n✨ Event-level scenario is LIVE!`);
    console.log(`✅ Seeded ${users.length} users and ${events.length} events.`);
    console.log(`👉 Anomalies are concentrated in Europe / Pro plan.`);

    // 4. Seed Operational State Snapshots (for the dashboard/analyze_metrics tool)
    console.log("📈 Seeding high-level operational state snapshots...");
    const snapshots = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(now.getTime() - (4 - i) * 24 * 60 * 60 * 1000);
      const isAnomalyDay = i >= 3; // Last 2 days are anomalies

      snapshots.push({
        snapshotAt: date,
        metrics: [
          {
            name: "churn_rate",
            value: isAnomalyDay ? 12.5 + Math.random() * 2 : 4.2 + Math.random(),
            unit: "%",
            trend: isAnomalyDay ? "up" : "stable",
            isAnomaly: isAnomalyDay,
            period: "24h"
          },
          {
            name: "customer_acquisition_cost",
            value: 85 + Math.random() * 10,
            unit: "$",
            trend: "stable",
            isAnomaly: false,
            period: "24h"
          }
        ],
        activeAnomalies: isAnomalyDay ? 1 : 0,
        healthScore: isAnomalyDay ? 0.6 : 0.95
      });
    }
    await db.collection("operational_state").insertMany(snapshots);
    console.log("✅ Seeded 5 operational state snapshots.");

  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await client.close();
  }
}

seedEventData();
