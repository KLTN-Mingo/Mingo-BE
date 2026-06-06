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
  INTERACTION_SIGNAL_MULTIPLIERS,
  MIN_VIEW_DURATION_SECONDS,
} from "../constants/interaction.constants";
import {
  ProfileScoreEntry,
  updateProfileScoreMap,
} from "../utils/profile-score.util";

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
  private static readonly PROFILE_UPDATE_MAX_RETRIES = 3;

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

    const signalMultiplier = INTERACTION_SIGNAL_MULTIPLIERS[type] ?? 1.0;
    const delta = weight * signalMultiplier;
    const topics = ((post as any).topics ?? []).map((topic: string) =>
      this.sanitizeKey(topic)
    );
    const authorId = (post as any).userId?.toString();

    const postHashtags = await PostHashtagModel.find({ postId: new Types.ObjectId(postId) })
      .select("hashtag")
      .lean();
    const hashtags = postHashtags.map(({ hashtag }) => this.sanitizeKey(hashtag));

    await this.updateProfileWithRetry({
      userId,
      topics,
      hashtags,
      authorId,
      delta,
      now: new Date(),
    });
  }

  private async updateProfileWithRetry(input: {
    userId: string;
    topics: string[];
    hashtags: string[];
    authorId?: string;
    delta: number;
    now: Date;
  }): Promise<void> {
    for (
      let attempt = 1;
      attempt <= InteractionTrackerService.PROFILE_UPDATE_MAX_RETRIES;
      attempt++
    ) {
      try {
        const profile =
          (await UserProfileModel.findOne({
            userId: new Types.ObjectId(input.userId),
          })) ??
          new UserProfileModel({
            userId: new Types.ObjectId(input.userId),
            topicScores: new Map<string, ProfileScoreEntry>(),
            hashtagScores: new Map<string, ProfileScoreEntry>(),
            authorScores: new Map<string, ProfileScoreEntry>(),
            interactionCount: 0,
          });

        updateProfileScoreMap(
          profile.topicScores,
          input.topics,
          input.delta,
          input.now
        );
        updateProfileScoreMap(
          profile.hashtagScores,
          input.hashtags,
          input.delta * 0.9,
          input.now
        );
        if (input.authorId) {
          updateProfileScoreMap(
            profile.authorScores,
            [input.authorId],
            input.delta * 0.7,
            input.now
          );
        }

        profile.interactionCount += 1;
        await profile.save();
        return;
      } catch (error) {
        const retryable =
          error instanceof mongoose.Error.VersionError ||
          (error as { code?: number }).code === 11000;
        if (
          !retryable ||
          attempt === InteractionTrackerService.PROFILE_UPDATE_MAX_RETRIES
        ) {
          throw error;
        }
      }
    }
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
      [InteractionType.FOLLOW_FROM_POST]: { followedFromPost: true },
    };
    return map[type] ?? {};
  }

  // Sanitize key cho MongoDB Map field — không cho phép . trong key
  private sanitizeKey(key: string): string {
    return key.replace(/\./g, "_").replace(/\$/g, "_").trim();
  }
}

export const interactionTrackerService = new InteractionTrackerService();
