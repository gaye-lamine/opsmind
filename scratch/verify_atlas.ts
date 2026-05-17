import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI;

async function verify() {
  if (!MONGODB_URI) throw new Error("No MONGODB_URI");
  
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db("opsmind");
    
    const userCount = await db.collection("users").countDocuments();
    const metricsCount = await db.collection("metrics").countDocuments();
    
    console.log(`Users count: ${userCount}`);
    console.log(`Metrics count: ${metricsCount}`);
    
    if (metricsCount > 0) {
      const sampleMetric = await db.collection("metrics").findOne({ type: "churn" });
      console.log("Sample churn metric:", JSON.stringify(sampleMetric, null, 2));
    }
    
    if (userCount > 0) {
      const sampleUser = await db.collection("users").findOne({});
      console.log("Sample user:", JSON.stringify(sampleUser, null, 2));
    }

  } finally {
    await client.close();
  }
}

verify().catch(console.error);
