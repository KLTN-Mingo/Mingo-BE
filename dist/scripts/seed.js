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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: ".env.local" });
const node_dns_1 = __importDefault(require("node:dns"));
const mongoose_1 = __importDefault(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const user_model_1 = require("../models/user.model");
const post_model_1 = require("../models/post.model");
node_dns_1.default.setServers(["8.8.8.8", "1.1.1.1"]);
function loadTopics() {
    const filePath = path.join(process.cwd(), "data", "social_media_topics_v2.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return data.topics ?? [];
}
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle(arr) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
function buildContentFromTopics(topics) {
    const count = 1 + Math.floor(Math.random() * 3); // 1–3 topics
    const chosen = shuffle(topics).slice(0, count);
    const sentences = [];
    const topicNames = [];
    for (const t of chosen) {
        topicNames.push(t.topic);
        const kws = [...(t.keywords_vi ?? []), ...(t.keywords_en ?? [])];
        if (kws.length === 0)
            continue;
        const pickedKeywords = shuffle(kws).slice(0, 3);
        sentences.push(`Bài viết về ${t.topic.toLowerCase()}: ${pickedKeywords.join(", ")}.`);
    }
    return {
        content: sentences.join(" "),
        topicNames,
    };
}
async function seed() {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
        console.error("MONGO_URI không được cấu hình trong .env.local");
        process.exit(1);
    }
    await mongoose_1.default.connect(MONGO_URI, { tls: true });
    console.log("✓ Đã kết nối MongoDB");
    const topics = loadTopics();
    console.log(`✓ Đã load ${topics.length} topics từ social_media_topics_v2.json`);
    const USER_COUNT = 200;
    const POSTS_PER_USER = 20; // 200 * 20 = 4000 posts
    console.log(`→ Bắt đầu tạo ${USER_COUNT} user và ~${USER_COUNT * POSTS_PER_USER} post ...`);
    const passwordHash = await bcrypt_1.default.hash("123456", 10);
    const createdUserIds = [];
    for (let i = 0; i < USER_COUNT; i++) {
        const phoneNumber = `090${(1000000 + i).toString().slice(1)}`;
        const name = `Seed User ${i + 1}`;
        const user = await user_model_1.UserModel.create({
            phoneNumber,
            passwordHash,
            name,
            verified: true,
            isActive: true,
        });
        createdUserIds.push(user._id);
    }
    console.log(`✓ Đã tạo ${createdUserIds.length} user`);
    const postBulkOps = [];
    for (const userId of createdUserIds) {
        for (let i = 0; i < POSTS_PER_USER; i++) {
            const { content, topicNames } = buildContentFromTopics(topics);
            const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
            postBulkOps.push({
                insertOne: {
                    document: {
                        userId,
                        contentText: content,
                        visibility: post_model_1.PostVisibility.PUBLIC,
                        likesCount: 0,
                        commentsCount: 0,
                        sharesCount: 0,
                        savesCount: 0,
                        viewsCount: 0,
                        moderationStatus: post_model_1.ModerationStatus.APPROVED,
                        isHidden: false,
                        isEdited: false,
                        topics: topicNames,
                        hotScore: 0,
                        createdAt,
                        updatedAt: createdAt,
                    },
                },
            });
        }
    }
    if (postBulkOps.length > 0) {
        const result = await post_model_1.PostModel.bulkWrite(postBulkOps);
        console.log(`✓ Đã tạo ${result.insertedCount ?? postBulkOps.length} post`);
    }
    await mongoose_1.default.disconnect();
    console.log("✓ Seed hoàn tất, đã ngắt kết nối MongoDB");
}
seed().catch((err) => {
    console.error("Seed thất bại:", err);
    process.exit(1);
});
