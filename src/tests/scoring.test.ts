// src/tests/scoring.test.ts
import { ScoringService } from "../services/scoring.service";
import { IPost }          from "../models/post.model";
import { IUserProfile }   from "../models/user-profile.model";

const service = new ScoringService();
const scoringNow = new Date("2026-06-06T00:00:00.000Z");

const mockPost = {
  _id:           "post_001",
  userId:        "author_001",
  topics:        ["Công nghệ - Technology", "Lập trình - Programming"],
  likesCount:    120,
  commentsCount: 30,
  sharesCount:   15,
  savesCount:    20,
  viewsCount:    800,
  hotScore:      0,
  createdAt:     new Date(Date.now() - 3 * 3_600_000),
} as unknown as IPost;

const normalProfile = {
  interactionCount: 25,
  topicScores:  new Map([
    ["Công nghệ - Technology", {
      score: 15,
      lastUpdatedAt: new Date("2026-05-27T00:00:00.000Z"),
    }],
    ["Lập trình - Programming", {
      score: 10,
      lastUpdatedAt: new Date("2026-06-05T00:00:00.000Z"),
    }],
  ]),
  authorScores:  new Map([["author_001", {
    score: 5,
    lastUpdatedAt: new Date("2026-06-05T00:00:00.000Z"),
  }]]),
  hashtagScores: new Map(),
} as unknown as IUserProfile;

const coldProfile = {
  interactionCount: 3,
  topicScores:   new Map(),
  authorScores:  new Map(),
  hashtagScores: new Map(),
} as unknown as IUserProfile;

async function run() {
  console.log("=== Scoring Engine Test ===\n");

  // Mock getFollowingIds — tránh cần kết nối MongoDB
   // không dùng jest — mock thủ công bằng cách override method
  const originalGetFollowing = service["getFollowingIds"].bind(service);
  service["getFollowingIds"] = async (_userId: string) => {
    return new Set(["author_001"]);   // giả sử đang follow author_001
  };

  // ── Test 1: Normal user, đang follow tác giả ──────────────────────────
  const r1 = await service.scorePosts(
    [mockPost],
    "user_normal",
    normalProfile,
    undefined,
    scoringNow
  );
  console.log("Test 1 — Normal user + following author:");
  console.log(`  content    = ${r1[0].breakdown.content.toFixed(2)}`);
  console.log(`  popularity = ${r1[0].breakdown.popularity.toFixed(2)}`);
  console.log(`  social     = ${r1[0].breakdown.social.toFixed(2)}`);
  console.log(`  FINAL      = ${r1[0].breakdown.final.toFixed(2)}`);
  console.log(`  ${r1[0].breakdown.content > 0   ? "✅" : "❌"} content > 0`);
  console.log(`  ${r1[0].breakdown.social  > 0   ? "✅" : "❌"} social > 0`);
  const expectedContent =
    15 * Math.pow(0.98, 10) +
    10 * Math.pow(0.98, 1) +
    5 * Math.pow(0.98, 1) * 1.2;
  if (Math.abs(r1[0].breakdown.content - expectedContent) > 0.0001) {
    throw new Error(
      `Expected independently decayed content score ${expectedContent}, received ${r1[0].breakdown.content}`
    );
  }

  // ── Test 2: Cold start, không follow ai ───────────────────────────────
  service["getFollowingIds"] = async (_userId: string) => new Set<string>();

  const r2 = await service.scorePosts([mockPost], "user_new", coldProfile);
  console.log("\nTest 2 — Cold start, không follow ai:");
  console.log(`  content    = ${r2[0].breakdown.content.toFixed(2)}`);
  console.log(`  popularity = ${r2[0].breakdown.popularity.toFixed(2)}`);
  console.log(`  social     = ${r2[0].breakdown.social.toFixed(2)}`);
  console.log(`  FINAL      = ${r2[0].breakdown.final.toFixed(2)}`);
  console.log(`  ${r2[0].breakdown.content === 0 ? "✅" : "❌"} content = 0`);
  console.log(`  ${r2[0].breakdown.popularity > 0 ? "✅" : "❌"} popularity > 0`);
  console.log(`  ${r2[0].breakdown.social    === 0 ? "✅" : "❌"} social = 0`);

  // ── Test 3: Normal user, KHÔNG follow tác giả ─────────────────────────
  service["getFollowingIds"] = async (_userId: string) => new Set<string>();

  const r3 = await service.scorePosts([mockPost], "user_normal", normalProfile);
  console.log("\nTest 3 — Normal user, không follow tác giả:");
  console.log(`  social     = ${r3[0].breakdown.social.toFixed(2)}`);
  console.log(`  ${r3[0].breakdown.social === 0 ? "✅" : "❌"} social = 0`);

  console.log("\n=== Done ===");

  // Restore lại method gốc
  service["getFollowingIds"] = originalGetFollowing;
}

run().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
