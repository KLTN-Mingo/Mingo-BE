"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/scripts/seed-users.ts
const mongoose_1 = __importDefault(require("mongoose"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const user_model_1 = require("../models/user.model");
// ─── Config ───────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/yourdb";
const JSON_FILE = path.resolve(__dirname, "../../data/users.json");
const BATCH_SIZE = 100; // an toàn với < 1,000 bản ghi
// ─── Main ─────────────────────────────────────────────────────────────────────
async function seedUsers() {
    try {
        // 1. Kết nối MongoDB
        console.log("🔌 Connecting to MongoDB...");
        await mongoose_1.default.connect(MONGO_URI);
        console.log("✅ Connected:", MONGO_URI);
        // 2. Đọc file JSON
        if (!fs.existsSync(JSON_FILE)) {
            throw new Error(`❌ File not found: ${JSON_FILE}`);
        }
        const raw = fs.readFileSync(JSON_FILE, "utf-8");
        const users = JSON.parse(raw);
        console.log(`📂 Loaded ${users.length} records from JSON`);
        // 3. (Tuỳ chọn) Xoá dữ liệu cũ trước khi seed
        // await UserModel.deleteMany({});
        // console.log("🗑️  Cleared existing users");
        // 4. Bulk insert theo batch
        let inserted = 0;
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = users.slice(i, i + BATCH_SIZE);
            const result = await user_model_1.UserModel.insertMany(batch, {
                ordered: false, // tiếp tục nếu 1 doc lỗi (vd: trùng email)
            });
            inserted += result.length;
            console.log(`  ↳ Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${result.length} docs`);
        }
        console.log(`\n🎉 Done! Total inserted: ${inserted}/${users.length}`);
    }
    catch (err) {
        // insertMany với ordered:false trả về lỗi nhưng vẫn insert được các doc hợp lệ
        if (err.name === "BulkWriteError") {
            console.warn(`⚠️  BulkWriteError: ${err.result?.nInserted} inserted, ${err.writeErrors?.length} skipped (duplicates?)`);
        }
        else {
            console.error("❌ Error:", err.message);
            process.exit(1);
        }
    }
    finally {
        await mongoose_1.default.disconnect();
        console.log("🔌 Disconnected from MongoDB");
    }
}
seedUsers();
