"use strict";
// scripts/drop-like-indexes.ts
// Chạy: npx ts-node scripts/drop-like-indexes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: ".env.local" });
const mongoose_1 = __importDefault(require("mongoose"));
async function dropIndexes() {
    try {
        await mongoose_1.default.connect(process.env.MONGO_URI, { tls: true });
        console.log("Connected to MongoDB");
        const db = mongoose_1.default.connection.db;
        const collection = db?.collection("likes");
        if (collection) {
            // Drop all indexes except _id
            await collection.dropIndexes();
            console.log("Dropped all indexes on likes collection");
        }
        await mongoose_1.default.disconnect();
        console.log("Done!");
        process.exit(0);
    }
    catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}
dropIndexes();
