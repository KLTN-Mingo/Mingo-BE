import { Types } from "mongoose";
import { FeedImpressionModel } from "../models/feed-impression.model";
import {
  UserInteractionModel,
  InteractionSource,
} from "../models/user-interaction.model";

export type ImpressionTab = "friends" | "explore";

type ImpressionScoreBreakdown = {
  content?: number;
  popularity?: number;
  social?: number;
  final?: number;
};

type ImpressionItem = {
  postId: string;
  position: number;
  score?: ImpressionScoreBreakdown;
};

export interface FeedMetricsDto {
  windowDays: number;
  tab?: ImpressionTab;
  impressions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  hides: number;
  notInterested: number;
  ctr: number;
  engagementRate: number;
  negativeFeedbackRate: number;
}

export class FeedAnalyticsService {
  async trackImpressions(
    userId: string,
    tab: ImpressionTab,
    items: ImpressionItem[]
  ): Promise<string> {
    if (items.length === 0) return "";

    const requestId = new Types.ObjectId().toString();
    const source =
      tab === "friends" ? InteractionSource.FEED : InteractionSource.EXPLORE;

    const docs = items
      .filter((item) => Types.ObjectId.isValid(item.postId))
      .map((item) => ({
        userId: new Types.ObjectId(userId),
        postId: new Types.ObjectId(item.postId),
        requestId,
        tab,
        source,
        position: item.position,
        score: item.score?.final,
        scoreContent: item.score?.content,
        scorePopularity: item.score?.popularity,
        scoreSocial: item.score?.social,
      }));

    if (docs.length === 0) return requestId;

    await FeedImpressionModel.insertMany(docs, { ordered: false });
    return requestId;
  }

  async getMetrics(days: number, tab?: ImpressionTab): Promise<FeedMetricsDto> {
    const safeDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 7;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const impressionMatch: Record<string, unknown> = {
      createdAt: { $gte: since },
    };
    if (tab) impressionMatch.tab = tab;

    const impressionSources =
      tab === "friends"
        ? [InteractionSource.FEED]
        : tab === "explore"
          ? [InteractionSource.EXPLORE]
          : [InteractionSource.FEED, InteractionSource.EXPLORE];

    const interactionMatch: Record<string, unknown> = {
      createdAt: { $gte: since },
      source: { $in: impressionSources },
    };

    const [
      impressions,
      views,
      likes,
      comments,
      shares,
      saves,
      hides,
      notInterested,
    ] = await Promise.all([
      FeedImpressionModel.countDocuments(impressionMatch),
      UserInteractionModel.countDocuments({
        ...interactionMatch,
        viewed: true,
      }),
      UserInteractionModel.countDocuments({ ...interactionMatch, liked: true }),
      UserInteractionModel.countDocuments({
        ...interactionMatch,
        commented: true,
      }),
      UserInteractionModel.countDocuments({
        ...interactionMatch,
        shared: true,
      }),
      UserInteractionModel.countDocuments({ ...interactionMatch, saved: true }),
      UserInteractionModel.countDocuments({
        ...interactionMatch,
        feedbackType: "hide",
      }),
      UserInteractionModel.countDocuments({
        ...interactionMatch,
        feedbackType: "not_interested",
      }),
    ]);

    const ctr = impressions > 0 ? views / impressions : 0;
    const engagementActions = likes + comments + shares + saves;
    const engagementRate =
      impressions > 0 ? engagementActions / impressions : 0;
    const negativeFeedbackRate =
      impressions > 0 ? (hides + notInterested) / impressions : 0;

    return {
      windowDays: safeDays,
      tab,
      impressions,
      views,
      likes,
      comments,
      shares,
      saves,
      hides,
      notInterested,
      ctr,
      engagementRate,
      negativeFeedbackRate,
    };
  }
}

export const feedAnalyticsService = new FeedAnalyticsService();
