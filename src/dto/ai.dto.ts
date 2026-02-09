// // src/dtos/ai.dto.ts
// import { InteractionSource } from "../models/user-interaction.model";

// import { PostResponseDto } from "./post.dto";

// // ==========================================
// // AI MODERATION DTOs
// // ==========================================

// export class ModerateContentDto {
//   contentText!: string;
//   contentType!: "post" | "comment";
// }

// export class ModerationResultDto {
//   isSafe!: boolean;
//   scores!: {
//     toxic: number;
//     hateSpeech: number;
//     spam: number;
//     overallRisk: number;
//   };
//   suggestion!: "approve" | "review" | "reject";
//   reasons?: string[];
//   aiProvider!: string;
//   checkedAt!: Date;
// }

// export class BatchModerateDto {
//   items!: Array<{
//     id: string;
//     contentText: string;
//     contentType: "post" | "comment";
//   }>;
// }

// export class BatchModerationResultDto {
//   results!: Array<{
//     id: string;
//     moderation: ModerationResultDto;
//   }>;
//   totalProcessed!: number;
//   totalFlagged!: number;
// }

// // ==========================================
// // RECOMMENDATION DTOs
// // ==========================================

// export class TrackInteractionDto {
//   postId!: string;
//   viewed?: boolean;
//   viewDuration?: number;
//   liked?: boolean;
//   commented?: boolean;
//   shared?: boolean;
//   saved?: boolean;
//   source!: InteractionSource;
// }

// export class GetRecommendationsDto {
//   page?: number;
//   limit?: number;
//   excludePostIds?: string[];
// }

// export class RecommendedPostsDto {
//   posts!: PostResponseDto[];
//   algorithm!: "content_based" | "collaborative" | "hybrid";
//   pagination!: {
//     page: number;
//     limit: number;
//     hasMore: boolean;
//   };
// }

// export class UpdatePreferencesDto {
//   interests?: string[]; // Hashtags
//   notInterestedHashtags?: string[];
//   notInterestedUsers?: string[];
// }

// export class UserPreferencesDto {
//   contentTypes!: {
//     text: number;
//     image: number;
//     video: number;
//   };
//   topInterests!: Array<{
//     hashtag: string;
//     score: number;
//   }>;
//   notInterestedHashtags!: string[];
//   lastCalculated!: Date;
// }

// export class HidePostDto {
//   postId!: string;
//   reason?: "not_interested" | "seen_too_much" | "offensive";
// }

// export class NotInterestedDto {
//   hashtag?: string;
//   userId?: string;
// }

// // ==========================================
// // CULTURE TRANSLATION DTOs
// // ==========================================

// export class TranslateTermDto {
//   term!: string;
//   language?: TranslationLanguage;
//   context?: string;
// }

// export class TranslationResponseDto {
//   term!: string;
//   explanation!: string;
//   context?: string;
//   origin?: string;
//   tone?: TranslationTone;
//   language!: TranslationLanguage;
//   category?: TranslationCategory;
//   examples?: string[];
//   usageCount!: number;
//   confidence?: number;
//   aiProvider?: string;
// }

// export class BatchTranslateDto {
//   terms!: Array<{
//     term: string;
//     context?: string;
//   }>;
//   language?: TranslationLanguage;
// }

// export class BatchTranslationResultDto {
//   translations!: TranslationResponseDto[];
//   totalTranslated!: number;
//   cached!: number;
//   newTranslations!: number;
// }

// export class SearchTranslationsDto {
//   query!: string;
//   language?: TranslationLanguage;
//   category?: TranslationCategory;
//   page?: number;
//   limit?: number;
// }

// export class PaginatedTranslationsDto {
//   translations!: TranslationResponseDto[];
//   pagination!: {
//     page: number;
//     limit: number;
//     total: number;
//   };
// }

// // ==========================================
// // TRENDING DTOs
// // ==========================================

// export class GetTrendingHashtagsDto {
//   period?: "hourly" | "daily" | "weekly";
//   limit?: number;
//   date?: Date;
// }

// export class TrendingHashtagDto {
//   hashtag!: string;
//   postsCount!: number;
//   interactionsCount!: number;
//   uniqueUsersCount!: number;
//   trendingScore!: number;
//   trend!: "rising" | "stable" | "falling";
//   percentageChange?: number;
// }

// export class TrendingHashtagsResponseDto {
//   trending!: TrendingHashtagDto[];
//   period!: string;
//   generatedAt!: Date;
// }

// export class AnalyzeHashtagDto {
//   hashtag!: string;
//   days?: number; // Default 7
// }

// export class HashtagAnalyticsDto {
//   hashtag!: string;
//   totalPosts!: number;
//   totalInteractions!: number;
//   uniqueUsers!: number;
//   averageEngagement!: number;
//   peakTime?: Date;
//   relatedHashtags!: string[];
//   timeSeriesData!: Array<{
//     date: Date;
//     posts: number;
//     interactions: number;
//   }>;
// }

// // ==========================================
// // FEED ALGORITHM DTOs
// // ==========================================

// export class FeedConfigDto {
//   algorithm?: "chronological" | "ranked" | "personalized";
//   includeRecommendations?: boolean;
//   recommendationRatio?: number; // 0-1
// }

// export class FeedResponseDto {
//   posts!: PostResponseDto[];
//   hasRecommendations!: boolean;
//   algorithm!: string;
//   pagination!: {
//     page: number;
//     limit: number;
//     hasMore: boolean;
//   };
// }

// export class ExplorePostsDto {
//   page?: number;
//   limit?: number;
//   categories?: string[];
// }

// export class RefreshFeedDto {
//   lastPostId?: string; // For "pull to refresh"
// }
