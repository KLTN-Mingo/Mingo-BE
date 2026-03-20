// src/services/hot-score-cron.service.ts
import { PostModel, ModerationStatus } from "../models/post.model";
import type { IPost } from "../models/post.model";
import { calculateHotScore } from "../utils/hot-score.util";
import { MAX_POST_AGE_DAYS, HOT_SCORE_CRON_INTERVAL_MINUTES, HOT_SCORE_BATCH_SIZE } from "../constants/feed.constants";

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

export async function runHotScoreUpdate(): Promise<{ updated: number; batches: number }> {
  if (isRunning) {
    console.log("[HotScoreCron] Bỏ qua: job trước vẫn đang chạy.");
    return { updated: 0, batches: 0 };
  }

  isRunning = true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_POST_AGE_DAYS);

  let totalUpdated = 0;
  let batchCount = 0;

  try {
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const posts = await PostModel.find({
        isHidden: false,
        moderationStatus: ModerationStatus.APPROVED,
        createdAt: { $gte: cutoff },
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(HOT_SCORE_BATCH_SIZE)
        .lean();

      if (posts.length === 0) break;

      const ops = posts.map((post) => {
        const score = calculateHotScore(post as IPost);
        const now = new Date();
        return {
          updateOne: {
            filter: { _id: (post as any)._id },
            update: { $set: { hotScore: score, hotScoreUpdatedAt: now } },
          },
        };
      });

      await PostModel.bulkWrite(ops);
      totalUpdated += posts.length;
      batchCount += 1;
      skip += HOT_SCORE_BATCH_SIZE;
      hasMore = posts.length === HOT_SCORE_BATCH_SIZE;
    }

    if (totalUpdated > 0) {
      console.log(`[HotScoreCron] Đã cập nhật hotScore cho ${totalUpdated} bài (${batchCount} batch).`);
    }
  } catch (err) {
    console.error("[HotScoreCron] Lỗi:", err);
  } finally {
    isRunning = false;
  }

  return { updated: totalUpdated, batches: batchCount };
}

export function startHotScoreCron(): void {
  if (intervalId) return;

  const ms = HOT_SCORE_CRON_INTERVAL_MINUTES * 60 * 1000;
  runHotScoreUpdate().then(() => {
    intervalId = setInterval(() => runHotScoreUpdate(), ms);
    console.log(`[HotScoreCron] Đã lên lịch chạy mỗi ${HOT_SCORE_CRON_INTERVAL_MINUTES} phút.`);
  });
}

export function stopHotScoreCron(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[HotScoreCron] Đã dừng.");
  }
}
