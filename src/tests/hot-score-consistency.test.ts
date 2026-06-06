import { ScoringService } from "../services/scoring.service";
import { calculateHotScore } from "../utils/hot-score.util";
import type { IPost } from "../models/post.model";

const now = new Date("2026-06-06T00:00:00.000Z");
const post = {
  _id: "hot-score-post",
  userId: "author-1",
  topics: [],
  likesCount: 20,
  commentsCount: 10,
  sharesCount: 4,
  savesCount: 5,
  viewsCount: 100,
  hotScore: 0,
  createdAt: new Date("2026-06-05T20:00:00.000Z"),
} as unknown as IPost;

async function run(): Promise<void> {
  const service = new ScoringService();
  const scored = await service.scorePosts(
    [post],
    "user-1",
    null,
    new Set(),
    now
  );
  const cronValue = calculateHotScore(post, now);
  const fallbackValue = scored[0].breakdown.popularity;

  if (Math.abs(cronValue - fallbackValue) > 0.0001) {
    throw new Error(
      `Cron and fallback HotScore differ: ${cronValue} vs ${fallbackValue}`
    );
  }

  console.log("hot score consistency test passed");
}

run().catch((error) => {
  console.error("hot score consistency test failed", error);
  process.exit(1);
});
