// src/services/scoring.service.ts
import { Types }        from "mongoose";
import { IPost }        from "../models/post.model";
import { IUserProfile } from "../models/user-profile.model";
import { FollowModel }  from "../models/follow.model";
import {
  SCORE_WEIGHTS,
  COLD_START_THRESHOLD,
  POPULARITY_GRAVITY,
} from "../constants/feed.constants";

export interface ScoredPost {
  post:  IPost;
  score: number;
  breakdown: {
    content:    number;
    popularity: number;
    social:     number;
    final:      number;
  };
}

/** Mongoose Map khi .lean() trở thành plain object — không có .get */
function scoreFromMapOrRecord(
  scores: Map<string, number> | Record<string, number> | undefined | null,
  key: string
): number {
  if (scores == null) return 0;
  if (scores instanceof Map) return scores.get(key) ?? 0;
  const v = (scores as Record<string, number>)[key];
  return typeof v === "number" ? v : 0;
}

export class ScoringService {

  // ─── Entry point: chấm điểm nhiều posts song song ────────────────────────

  async scorePosts(
    posts:         IPost[],
    userId:        string,
    userProfile:   IUserProfile | null,
    followingIds?: Set<string>
  ): Promise<ScoredPost[]> {
    const isNewUser = this.isColdStart(userProfile);
    const weights   = isNewUser ? SCORE_WEIGHTS.cold_start : SCORE_WEIGHTS.normal;
    const following = followingIds ?? await this.getFollowingIds(userId);

    const results = await Promise.all(
      posts.map((post) =>
        this.scoreOne(post, userProfile, following, weights)
      )
    );

    return results.sort((a, b) => b.score - a.score);
  }

  // ─── Score 1 post ─────────────────────────────────────────────────────────

  private scoreOne(
    post:         IPost,
    userProfile:  IUserProfile | null,
    followingIds: Set<string>,
    weights:      typeof SCORE_WEIGHTS.normal
  ): ScoredPost {
    const cs = this.contentScore(post, userProfile);
    const ps = this.popularityScore(post);
    const ss = this.socialScore(post, followingIds);

    const final =
      weights.content    * cs +
      weights.popularity * ps +
      weights.social     * ss;

    return {
      post,
      score: final,
      breakdown: { content: cs, popularity: ps, social: ss, final },
    };
  }

  // ─── Score 1: Content-based ───────────────────────────────────────────────
  // Đo độ khớp Post.topics vs UserProfile.topicScores + authorScores

  private contentScore(
    post:        IPost,
    userProfile: IUserProfile | null
  ): number {
    if (!userProfile) return 0;

    let score = 0;

    // Topic matching
    // Post.topics dạng "Công nghệ - Technology"
    // UserProfile.topicScores key đã sanitize dấu chấm → gạch dưới
    const topics: string[] = post.topics ?? [];
    for (const topic of topics) {
      const key = topic.replace(/\./g, "_");
      score += scoreFromMapOrRecord(
        userProfile.topicScores as any,
        key
      );
    }

    // Author affinity — hay xem bài tác giả này thì boost
    const authorId = post.userId?.toString();
    if (authorId) {
      score += scoreFromMapOrRecord(
        userProfile.authorScores as any,
        authorId
      ) * 1.2;
    }

    return Math.max(0, Math.min(score, 100));
  }

  // ─── Score 2: Popularity ──────────────────────────────────────────────────
  // Dùng Post.hotScore đã cache; fallback tính tạm nếu chưa có cron

  private popularityScore(post: IPost): number {
    if (post.hotScore > 0) {
      return Math.min(post.hotScore, 100);
    }

    const engagements =
      (post.likesCount    ?? 0) * 3 +
      (post.commentsCount ?? 0) * 4 +
      (post.sharesCount   ?? 0) * 5 +
      (post.savesCount    ?? 0) * 4 +
      (post.viewsCount    ?? 0) * 0.1;

    const ageHours =
      (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000;

    const raw = engagements / Math.pow(ageHours + 2, POPULARITY_GRAVITY);
    return Math.min(raw * 2, 100);
  }

  // ─── Score 3: Social graph ────────────────────────────────────────────────
  // Bài từ người đang follow → điểm tối đa

  private socialScore(post: IPost, followingIds: Set<string>): number {
    return followingIds.has(post.userId?.toString()) ? 100 : 0;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private isColdStart(userProfile: IUserProfile | null): boolean {
    return !userProfile ||
      (userProfile.interactionCount ?? 0) < COLD_START_THRESHOLD;
  }

  async getFollowingIds(userId: string): Promise<Set<string>> {
    const follows = await FollowModel
      .find({
        followerId:   new Types.ObjectId(userId),
        followStatus: "accepted",
      })
      .select("followingId")
      .lean();

    return new Set(follows.map((f: any) => f.followingId.toString()));
  }
}

export const scoringService = new ScoringService();