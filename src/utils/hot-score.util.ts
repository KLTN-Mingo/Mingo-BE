// src/utils/hot-score.util.ts
import { IPost }              from "../models/post.model";
import { POPULARITY_GRAVITY } from "../constants/feed.constants";

export function calculateHotScore(post: IPost): number {
  const engagements =
    (post.likesCount    ?? 0) * 3 +
    (post.commentsCount ?? 0) * 4 +
    (post.sharesCount   ?? 0) * 5 +
    (post.savesCount    ?? 0) * 4 +
    (post.viewsCount    ?? 0) * 0.1;

  const ageHours =
    (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000;

  const raw = engagements / Math.pow(ageHours + 2, POPULARITY_GRAVITY);
  return Math.round(raw * 100) / 100;
}