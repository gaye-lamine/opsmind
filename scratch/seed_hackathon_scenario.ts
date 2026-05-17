import { MongoClient } from "mongodb";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
import path from "path";

// Load env from root
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/opsmind";

async function seedScenario() {
  console.log("🏗️ Building Hackathon Scenario: 'The European Pro-Plan Churn Crisis'...");
  
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("opsmind");

    // 1. Clean up old data
    console.log("🧹 Cleaning old operational data...");
    await db.collection("users").deleteMany({});
    await db.collection("metrics").deleteMany({});

    // 2. Seed Users
    console.log("👥 Seeding 300+ users across regions and plans...");
    const regions = ["Europe", "North America", "Asia", "South America"];
    const plans = ["Free", "Pro", "Enterprise"];
    const users = [];

    for (let i = 0; i < 350; i++) {
      const region = regions[Math.floor(Math.random() * regions.length)];
      const plan = plans[Math.floor(Math.random() * plans.length)];
      
      users.push({
        _id: `user_${randomUUID()}`,
        email: `user${i}@example.com`,
        region,
        plan,
        signupDate: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000),
        status: "active",
        lastActive: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000)
      });
    }
    await db.collection("users").insertMany(users);

    // 3. Seed Metrics with a Hidden Anomaly
    console.log("📊 Generating 90 days of metrics with a targeted anomaly...");
    const metrics = [];
    const now = new Date();

    for (let d = 0; d < 90; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);

      for (const region of regions) {
        for (const plan of plans) {
          // Default churn is low (1-3%)
          let churnRate = 1 + Math.random() * 2;
          let conversionRate = 5 + Math.random() * 5;

          // THE ANOMALY: Last 10 days, Europe + Pro plan has massive churn spike
          if (d < 10 && region === "Europe" && plan === "Pro") {
             churnRate = 15 + Math.random() * 10; // 15% to 25% churn!
             conversionRate = 1 + Math.random() * 2; // Conversion drops too
             console.log(`⚠️ Injected Anomaly for ${date.toISOString().split('T')[0]} - ${region} [${plan}]`);
          }

          metrics.push({
            timestamp: date,
            region,
            plan,
            churnRate,
            conversionRate,
            activeUsers: 100 + Math.floor(Math.random() * 500),
            revenue: 1000 + Math.floor(Math.random() * 5000)
          });
        }
      }
    }
    await db.collection("metrics").insertMany(metrics);

    console.log("\n✨ Scenario 'European Pro-Plan Churn Crisis' is LIVE!");
    console.log("👉 Now go to the Dashboard and ask: 'Analyze the churn rate by user cohort for the last 3 months and identify if there is a correlation with specific billing plans or regions.'");

  } catch (error) {
    console.error("❌ Scenario seeding failed:", error);
  } finally {
    await client.close();
  }
}

seedScenario();
