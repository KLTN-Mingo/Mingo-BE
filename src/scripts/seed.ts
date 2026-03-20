import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import dns from "node:dns";

import mongoose, { Types } from "mongoose";
import bcrypt from "bcrypt";
import * as fs from "fs";
import * as path from "path";

import { UserModel } from "../models/user.model";
import { PostModel, PostVisibility, ModerationStatus } from "../models/post.model";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

type TopicEntry = {
  id: string;
  topic: string;
  keywords_vi?: string[];
  keywords_en?: string[];
};

type TopicsFile = {
  topics: Array<
    TopicEntry & {
      keywords_vi: string[];
      keywords_en: string[];
    }
  >;
};

function loadTopics(): TopicEntry[] {
  const filePath = path.join(process.cwd(), "data", "social_media_topics_v2.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data: TopicsFile = JSON.parse(raw);
  return data.topics ?? [];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildContentFromTopics(topics: TopicEntry[]): { content: string; topicNames: string[] } {
  const count = 1 + Math.floor(Math.random() * 3); // 1–3 topics
  const chosen = shuffle(topics).slice(0, count);

  const sentences: string[] = [];
  const topicNames: string[] = [];

  for (const t of chosen) {
    topicNames.push(t.topic);
    const kws = [...(t.keywords_vi ?? []), ...(t.keywords_en ?? [])];
    if (kws.length === 0) continue;
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

  await mongoose.connect(MONGO_URI, { tls: true });
  console.log("✓ Đã kết nối MongoDB");

  const topics = loadTopics();
  console.log(`✓ Đã load ${topics.length} topics từ social_media_topics_v2.json`);

  const USER_COUNT = 200;
  const POSTS_PER_USER = 20; // 200 * 20 = 4000 posts

  console.log(`→ Bắt đầu tạo ${USER_COUNT} user và ~${USER_COUNT * POSTS_PER_USER} post ...`);

  const passwordHash = await bcrypt.hash("123456", 10);

  const createdUserIds: Types.ObjectId[] = [];

  for (let i = 0; i < USER_COUNT; i++) {
    const phoneNumber = `090${(1000000 + i).toString().slice(1)}`;
    const name = `Seed User ${i + 1}`;

    const user = await UserModel.create({
      phoneNumber,
      passwordHash,
      name,
      verified: true,
      isActive: true,
    });

    createdUserIds.push(user._id);
  }

  console.log(`✓ Đã tạo ${createdUserIds.length} user`);

  const postBulkOps: any[] = [];

  for (const userId of createdUserIds) {
    for (let i = 0; i < POSTS_PER_USER; i++) {
      const { content, topicNames } = buildContentFromTopics(topics);
      const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);

      postBulkOps.push({
        insertOne: {
          document: {
            userId,
            contentText: content,
            visibility: PostVisibility.PUBLIC,
            likesCount: 0,
            commentsCount: 0,
            sharesCount: 0,
            savesCount: 0,
            viewsCount: 0,
            moderationStatus: ModerationStatus.APPROVED,
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
    const result = await PostModel.bulkWrite(postBulkOps);
    console.log(`✓ Đã tạo ${result.insertedCount ?? postBulkOps.length} post`);
  }

  await mongoose.disconnect();
  console.log("✓ Seed hoàn tất, đã ngắt kết nối MongoDB");
}

seed().catch((err) => {
  console.error("Seed thất bại:", err);
  process.exit(1);
});

