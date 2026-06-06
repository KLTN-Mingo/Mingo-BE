import dotenv from "dotenv";
import mongoose from "mongoose";
import type { AnyBulkWriteOperation, Document as MongoDocument } from "mongodb";
import type { ProfileScoreEntry } from "../utils/profile-score.util";

dotenv.config({ path: ".env.local" });
dotenv.config();

type RawScoreMap =
  | Map<string, unknown>
  | Record<string, unknown>
  | null
  | undefined;

export interface UserProfileScoreMigrationResult {
  topicScores: Record<string, ProfileScoreEntry>;
  hashtagScores: Record<string, ProfileScoreEntry>;
  authorScores: Record<string, ProfileScoreEntry>;
  changed: boolean;
  removeLastCalculatedAt: boolean;
}

function validDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isFinite(date.getTime()) ? date : null;
}

function transformScoreMap(
  raw: RawScoreMap,
  fallbackTimestamp: Date
): { values: Record<string, ProfileScoreEntry>; changed: boolean } {
  const entries = raw instanceof Map ? Array.from(raw.entries()) : Object.entries(raw ?? {});
  const values: Record<string, ProfileScoreEntry> = {};
  let changed = false;

  for (const [key, value] of entries) {
    if (typeof value === "number") {
      values[key] = { score: value, lastUpdatedAt: fallbackTimestamp };
      changed = true;
      continue;
    }

    const objectValue = value as
      | { score?: unknown; lastUpdatedAt?: unknown }
      | null
      | undefined;
    const score = Number(objectValue?.score);
    const lastUpdatedAt = validDate(objectValue?.lastUpdatedAt);
    if (Number.isFinite(score) && lastUpdatedAt) {
      values[key] = { score, lastUpdatedAt };
      continue;
    }

    values[key] = {
      score: Number.isFinite(score) ? score : 0,
      lastUpdatedAt: lastUpdatedAt ?? fallbackTimestamp,
    };
    changed = true;
  }

  return { values, changed };
}

export function transformUserProfileScoreDocument(
  document: {
    topicScores?: RawScoreMap;
    hashtagScores?: RawScoreMap;
    authorScores?: RawScoreMap;
    updatedAt?: unknown;
    lastCalculatedAt?: unknown;
  },
  migrationTime: Date = new Date()
): UserProfileScoreMigrationResult {
  const fallbackTimestamp = validDate(document.updatedAt) ?? migrationTime;
  const topic = transformScoreMap(document.topicScores, fallbackTimestamp);
  const hashtag = transformScoreMap(document.hashtagScores, fallbackTimestamp);
  const author = transformScoreMap(document.authorScores, fallbackTimestamp);
  const removeLastCalculatedAt = document.lastCalculatedAt !== undefined;

  return {
    topicScores: topic.values,
    hashtagScores: hashtag.values,
    authorScores: author.values,
    changed:
      topic.changed ||
      hashtag.changed ||
      author.changed ||
      removeLastCalculatedAt,
    removeLastCalculatedAt,
  };
}

async function migrate(): Promise<void> {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("Missing MONGO_URI or MONGODB_URI");
  }

  const dryRun = process.argv.includes("--dry-run");
  await mongoose.connect(mongoUri);
  const collection = mongoose.connection.db!.collection("userprofiles");
  const cursor = collection.find({});
  let scanned = 0;
  let changed = 0;
  let operations: AnyBulkWriteOperation<MongoDocument>[] = [];

  for await (const document of cursor) {
    scanned++;
    const transformed = transformUserProfileScoreDocument(document as any);
    if (!transformed.changed) continue;
    changed++;
    if (dryRun) continue;

    operations.push({
      updateOne: {
        filter: { _id: document._id },
        update: {
          $set: {
            topicScores: transformed.topicScores,
            hashtagScores: transformed.hashtagScores,
            authorScores: transformed.authorScores,
          },
          ...(transformed.removeLastCalculatedAt && {
            $unset: { lastCalculatedAt: "" },
          }),
        },
      },
    });

    if (operations.length >= 500) {
      await collection.bulkWrite(operations);
      operations = [];
    }
  }

  if (!dryRun && operations.length > 0) {
    await collection.bulkWrite(operations);
  }

  console.log(
    `[UserProfile migration] scanned=${scanned} changed=${changed} dryRun=${dryRun}`
  );
  await mongoose.disconnect();
}

if (require.main === module) {
  migrate().catch(async (error) => {
    console.error("[UserProfile migration] failed:", error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
}
