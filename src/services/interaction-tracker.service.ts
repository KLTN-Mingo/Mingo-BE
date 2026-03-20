// src/services/interaction-tracker.service.ts
import mongoose, { Types } from "mongoose";
import {
  UserInteractionModel,
  InteractionType,
  InteractionSource,
  FeedbackType,
} from "../models/user-interaction.model";
import { UserProfileModel } from "../models/user-profile.model";
import { PostModel } from "../models/post.model";
import { PostHashtagModel } from "../models/post-hashtag.model";
import {
  INTERACTION_WEIGHTS,
  INTERACTION_DECAY,
  MIN_VIEW_DURATION_SECONDS,
} from "../constants/interaction.constants";

export interface TrackPayload {
  userId:       string;
  postId:       string;
  type:         InteractionType;
  viewDuration?: number;
  scrollDepth?:  number;
  source:        InteractionSource;
  deviceType?:   string;
}

export class InteractionTrackerService {

  // ─── Public ──────────────────────────────────────────────────────────────

  async track(payload: TrackPayload): Promise<void> {
    const { userId, postId, type, viewDuration, scrollDepth, source, deviceType } = payload;

    // Bỏ qua view quá ngắn
    if (type === InteractionType.VIEW) {
      if ((viewDuration ?? 0) < MIN_VIEW_DURATION_SECONDS) return;
    }

    const weight      = INTERACTION_WEIGHTS[type] ?? 1;
    const feedbackType = this.resolveFeedbackType(type);

    // Map type → boolean fields để cập nhật đúng field
    const booleanUpdate = this.resolveBooleanFields(type);

    // Upsert: mỗi cặp (userId, postId) chỉ có 1 document.
    // $set: cập nhật boolean (liked/commented/...) + metadata — không ghi đè lẫn nhau.
    // $inc: cộng dồn weight — like (3) + comment (4) = 7.
    await UserInteractionModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        postId: new Types.ObjectId(postId),
      },
      {
        $set: {
          feedbackType,
          source,
          ...(viewDuration !== undefined && { viewDuration }),
          ...(scrollDepth !== undefined && { scrollDepth }),
          ...(deviceType !== undefined && { deviceType }),
          ...booleanUpdate,
        },
        $inc: { weight },
      },
      { upsert: true, new: true }
    );

    // Cập nhật UserProfile async — không block response
    this.updateUserProfile(userId, postId, type, weight).catch((err) =>
      console.error("[InteractionTrackerService] updateUserProfile error:", err)
    );
  }

  // ─── Private: cập nhật UserProfile ───────────────────────────────────────

  private async updateUserProfile(
    userId: string,
    postId: string,
    type:   InteractionType,
    weight: number
  ): Promise<void> {
    const post = await PostModel
      .findById(postId)
      .select("topics userId")
      .lean();

    if (!post) return;

    const decay = INTERACTION_DECAY[type] ?? 1.0;
    const delta = weight * decay;

    const incUpdate: Record<string, number> = {};

    // topicScores — từ Post.topics (đã có sẵn trong schema mới)
    const topics: string[] = (post as any).topics ?? [];
    for (const topic of topics) {
      const key = `topicScores.${this.sanitizeKey(topic)}`;
      incUpdate[key] = delta;
    }

    // authorScores — UserProfile có authorScores, dùng luôn
    const authorId = (post as any).userId?.toString();
    if (authorId) {
      incUpdate[`authorScores.${authorId}`] = delta * 0.7;
    }

    // hashtagScores — từ PostHashtag (post không có field hashtags, nằm collection riêng)
    const postHashtags = await PostHashtagModel.find({ postId: new Types.ObjectId(postId) })
      .select("hashtag")
      .lean();

    for (const { hashtag } of postHashtags) {
      const key = `hashtagScores.${this.sanitizeKey(hashtag)}`;
      incUpdate[key] = delta * 0.9;
    }

    await UserProfileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $inc: {
          ...incUpdate,
          interactionCount: 1,
        },
        $set: {
          updatedAt:         new Date(),
          lastCalculatedAt:  new Date(),
        },
      },
      { upsert: true, new: true }
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  // Map InteractionType → FeedbackType
  private resolveFeedbackType(type: InteractionType): FeedbackType {
    const map: Partial<Record<InteractionType, FeedbackType>> = {
      [InteractionType.HIDE]:           FeedbackType.HIDE,
      [InteractionType.NOT_INTERESTED]: FeedbackType.NOT_INTERESTED,
      [InteractionType.SEE_MORE]:       FeedbackType.SEE_MORE,
      [InteractionType.REPORT]:         FeedbackType.REPORT,
    };
    return map[type] ?? FeedbackType.ORGANIC;
  }

  // Map InteractionType → boolean fields trong schema
  private resolveBooleanFields(
    type: InteractionType
  ): Partial<Record<string, boolean>> {
    const map: Partial<Record<InteractionType, Partial<Record<string, boolean>>>> = {
      [InteractionType.VIEW]:    { viewed:    true },
      [InteractionType.LIKE]:    { liked:     true },
      [InteractionType.COMMENT]: { commented: true },
      [InteractionType.SHARE]:   { shared:    true },
      [InteractionType.SAVE]:    { saved:     true },
    };
    return map[type] ?? {};
  }

  // Sanitize key cho MongoDB Map field — không cho phép . trong key
  private sanitizeKey(key: string): string {
    return key.replace(/\./g, "_").replace(/\$/g, "_").trim();
  }
}

export const interactionTrackerService = new InteractionTrackerService();