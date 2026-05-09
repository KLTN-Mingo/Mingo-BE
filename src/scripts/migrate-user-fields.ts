import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import dns from "node:dns";
import mongoose from "mongoose";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

async function migrate() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI không được cấu hình trong .env.local");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI, { tls: true });
  console.log("✓ Đã kết nối MongoDB");

  const result = await mongoose.connection.db!.collection("users").updateMany(
    {
      $or: [
        { violationCount: { $exists: false } },
        { violationLogs: { $exists: false } },
        { lastWarnedAt: { $exists: false } },
        { isBanned: { $exists: false } },
        { bannedUntil: { $exists: false } },
      ],
    },
    {
      $set: {
        violationCount: 0,
        lastWarnedAt: null,
        violationLogs: [],
        isBanned: false,
        bannedUntil: null,
      },
    }
  );

  console.log(`✓ Đã update ${result.modifiedCount} user documents`);
  await mongoose.disconnect();
  console.log("✓ Đã ngắt kết nối MongoDB");
}

migrate().catch((err) => {
  console.error("Migration thất bại:", err);
  process.exit(1);
});
