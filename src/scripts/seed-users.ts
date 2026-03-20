// src/scripts/seed-users.ts
import mongoose from "mongoose";
import * as fs from "fs";
import * as path from "path";
import { UserModel } from "../models/user.model";

// ─── Config ───────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/yourdb";
const JSON_FILE = path.resolve(__dirname, "../../data/users.json");
const BATCH_SIZE = 100; // an toàn với < 1,000 bản ghi

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seedUsers(): Promise<void> {
  try {
    // 1. Kết nối MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected:", MONGO_URI);

    // 2. Đọc file JSON
    if (!fs.existsSync(JSON_FILE)) {
      throw new Error(`❌ File not found: ${JSON_FILE}`);
    }
    const raw = fs.readFileSync(JSON_FILE, "utf-8");
    const users: object[] = JSON.parse(raw);
    console.log(`📂 Loaded ${users.length} records from JSON`);

    // 3. (Tuỳ chọn) Xoá dữ liệu cũ trước khi seed
    // await UserModel.deleteMany({});
    // console.log("🗑️  Cleared existing users");

    // 4. Bulk insert theo batch
    let inserted = 0;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const result = await UserModel.insertMany(batch, {
        ordered: false,   // tiếp tục nếu 1 doc lỗi (vd: trùng email)
      });
      inserted += result.length;
      console.log(`  ↳ Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${result.length} docs`);
    }

    console.log(`\n🎉 Done! Total inserted: ${inserted}/${users.length}`);
  } catch (err: any) {
    // insertMany với ordered:false trả về lỗi nhưng vẫn insert được các doc hợp lệ
    if (err.name === "BulkWriteError") {
      console.warn(`⚠️  BulkWriteError: ${err.result?.nInserted} inserted, ${err.writeErrors?.length} skipped (duplicates?)`);
    } else {
      console.error("❌ Error:", err.message);
      process.exit(1);
    }
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

seedUsers();
