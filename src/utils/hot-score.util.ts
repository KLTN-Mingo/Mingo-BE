// src/utils/hot-score.util.ts
import { IPost }              from "../models/post.model";
import {
  HOT_SCORE_MULTIPLIER,
  POPULARITY_GRAVITY,
} from "../constants/feed.constants";

export function calculateHotScore(post: IPost, now: Date = new Date()): number {
  const engagements =
    (post.likesCount    ?? 0) * 3 +
    (post.commentsCount ?? 0) * 4 +
    (post.sharesCount   ?? 0) * 5 +
    (post.savesCount    ?? 0) * 4 +
    (post.viewsCount    ?? 0) * 0.1;

  const ageHours =
    Math.max(0, now.getTime() - new Date(post.createdAt).getTime()) / 3_600_000;

  const raw = engagements / Math.pow(ageHours + 2, POPULARITY_GRAVITY);
  const hotScore = raw * HOT_SCORE_MULTIPLIER;
  return Math.round(hotScore * 100) / 100;
}
