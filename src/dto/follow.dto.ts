// src/dtos/follow.dto.ts
import { UserMinimalDto, UserProfileDto } from "./user.dto";

// ==========================================
// FOLLOW REQUEST DTOs
// ==========================================

export class FollowUserDto {
  userId!: string; // User to follow
}

export class UnfollowUserDto {
  userId!: string; // User to unfollow
}

export class AddBestfriendDto {
  userId!: string;
}

export class RemoveBestfriendDto {
  userId!: string;
}

export class GetFollowersDto {
  userId!: string;
  page?: number;
  limit?: number;
}

export class GetFollowingDto {
  userId!: string;
  page?: number;
  limit?: number;
}

export class GetBestfriendsDto {
  page?: number;
  limit?: number;
}

// ==========================================
// FOLLOW RESPONSE DTOs
// ==========================================

export class FollowResponseDto {
  id!: string;
  followerId!: string;
  followingId!: string;
  isBestfriend!: boolean;
  createdAt!: Date;
}

export class FollowerDto {
  id!: string;
  follower!: UserMinimalDto;
  isBestfriend!: boolean;
  followedAt!: Date;
  isFollowingBack?: boolean; // Mutual follow
}

export class FollowingDto {
  id!: string;
  following!: UserMinimalDto;
  isBestfriend!: boolean;
  followedAt!: Date;
  isFollower?: boolean; // Mutual follow
}

export class PaginatedFollowersDto {
  followers!: FollowerDto[];
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export class PaginatedFollowingDto {
  following!: FollowingDto[];
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export class BestfriendsDto {
  bestfriends!: UserProfileDto[];
  total!: number;
}

export class FollowStatsDto {
  followersCount!: number;
  followingCount!: number;
  bestfriendsCount!: number;
  mutualFollowsCount!: number;
}

// ==========================================
// BLOCK DTOs
// ==========================================

export class BlockUserDto {
  userId!: string;
  reason?: string;
}

export class UnblockUserDto {
  userId!: string;
}

export class GetBlockedUsersDto {
  page?: number;
  limit?: number;
}

export class BlockResponseDto {
  id!: string;
  blockerId!: string;
  blockedId!: string;
  reason?: string;
  createdAt!: Date;
}

export class BlockedUserDto {
  id!: string;
  user!: UserMinimalDto;
  reason?: string;
  blockedAt!: Date;
}

export class PaginatedBlockedUsersDto {
  blockedUsers!: BlockedUserDto[];
  pagination!: {
    page: number;
    limit: number;
    total: number;
  };
}
