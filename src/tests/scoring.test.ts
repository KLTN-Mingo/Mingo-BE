// src/tests/scoring.test.ts
import { ScoringService } from "../services/scoring.service";
import { IPost }          from "../models/post.model";
import { IUserProfile }   from "../models/user-profile.model";

const service = new ScoringService();

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
    ["Công nghệ - Technology",  15],
    ["Lập trình - Programming", 10],
  ]),
  authorScores:  new Map([["author_001", 5]]),
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
  const r1 = await service.scorePosts([mockPost], "user_normal", normalProfile);
  console.log("Test 1 — Normal user + following author:");
  console.log(`  content    = ${r1[0].breakdown.content.toFixed(2)}`);
  console.log(`  popularity = ${r1[0].breakdown.popularity.toFixed(2)}`);
  console.log(`  social     = ${r1[0].breakdown.social.toFixed(2)}`);
  console.log(`  FINAL      = ${r1[0].breakdown.final.toFixed(2)}`);
  console.log(`  ${r1[0].breakdown.content > 0   ? "✅" : "❌"} content > 0`);
  console.log(`  ${r1[0].breakdown.social  > 0   ? "✅" : "❌"} social > 0`);

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