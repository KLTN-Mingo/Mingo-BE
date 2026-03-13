// scripts/drop-like-indexes.ts
// Chạy: npx ts-node scripts/drop-like-indexes.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mongoose from "mongoose";

async function dropIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI!, { tls: true });
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db?.collection("likes");

    if (collection) {
      // Drop all indexes except _id
      await collection.dropIndexes();
      console.log("Dropped all indexes on likes collection");
    }

    await mongoose.disconnect();
    console.log("Done!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

dropIndexes();
