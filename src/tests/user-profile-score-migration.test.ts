import { transformUserProfileScoreDocument } from "../scripts/migrate-user-profile-score-entries";

const fallbackTimestamp = new Date("2026-06-06T00:00:00.000Z");
const existingTimestamp = new Date("2026-06-01T00:00:00.000Z");
const result = transformUserProfileScoreDocument(
  {
    topicScores: {
      technology: 10,
      cooking: { score: 5, lastUpdatedAt: existingTimestamp },
    },
    hashtagScores: new Map([["typescript", 7]]),
    authorScores: {},
    updatedAt: fallbackTimestamp,
    lastCalculatedAt: new Date("2026-05-01T00:00:00.000Z"),
  },
  fallbackTimestamp
);

const technology = result.topicScores.technology;
const cooking = result.topicScores.cooking;
const typescript = result.hashtagScores.typescript;

if (
  technology.score !== 10 ||
  technology.lastUpdatedAt.getTime() !== fallbackTimestamp.getTime()
) {
  throw new Error("Numeric topic score was not migrated with fallback timestamp");
}
if (
  cooking.score !== 5 ||
  cooking.lastUpdatedAt.getTime() !== existingTimestamp.getTime()
) {
  throw new Error("Already migrated score entry must remain unchanged");
}
if (
  typescript.score !== 7 ||
  typescript.lastUpdatedAt.getTime() !== fallbackTimestamp.getTime()
) {
  throw new Error("Numeric Map entry was not migrated");
}
if (!result.changed || !result.removeLastCalculatedAt) {
  throw new Error("Migration must report changed legacy data");
}

const secondPass = transformUserProfileScoreDocument(
  {
    topicScores: result.topicScores,
    hashtagScores: result.hashtagScores,
    authorScores: result.authorScores,
    updatedAt: fallbackTimestamp,
  },
  fallbackTimestamp
);
if (secondPass.changed) {
  throw new Error("Migration must be idempotent");
}

console.log("user profile score migration test passed");
