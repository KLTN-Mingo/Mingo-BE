// src/dtos/follow.dto.ts
import { UserMinimalDto, UserProfileDto } from "./user.dto";
import { FollowStatus, CloseFriendStatus } from "../models/follow.model";

// ==========================================
// ENUMS FOR RELATIONSHIP TYPE
// ==========================================

export enum RelationshipType {
  NONE = "none", // Không có quan hệ
  FOLLOWER = "follower", // Họ follow mình (pending hoặc accepted)
  FOLLOWING = "following", // Mình follow họ (pending hoặc accepted)
  FRIEND = "friend", // Cả 2 follow nhau (mutual - accepted)
  CLOSE_FRIEND = "close_friend", // Bạn thân
}

// ==========================================
// FOLLOW REQUEST DTOs
// ==========================================

export class SendFollowRequestDto {
  userId!: string; // User to follow
}

export class RespondFollowRequestDto {
  requestId!: string; // Follow request ID
  accept!: boolean; // true = accept, false = reject
}

export class UnfollowUserDto {
  userId!: string; // User to unfollow
}

export class CancelFollowRequestDto {
  userId!: string; // Cancel pending request to this user
}

// ==========================================
// CLOSE FRIEND REQUEST DTOs
// ==========================================

export class SendCloseFriendRequestDto {
  userId!: string; // User to request close friend
}

export class RespondCloseFriendRequestDto {
  requestId!: string; // Request ID (follow document ID)
  accept!: boolean; // true = accept, false = reject
}

export class RemoveCloseFriendDto {
  userId!: string; // Remove close friend status
}

// ==========================================
// QUERY DTOs
// ==========================================

export class GetFollowersDto {
  userId!: string;
  status?: FollowStatus; // Filter by status
  page?: number;
  limit?: number;
}

export class GetFollowingDto {
  userId!: string;
  status?: FollowStatus;
  page?: number;
  limit?: number;
}

export class GetFriendsDto {
  userId!: string;
  page?: number;
  limit?: number;
}

export class GetCloseFriendsDto {
  userId?: string;
  page?: number;
  limit?: number;
}

export class GetPendingRequestsDto {
  type: "follow" | "close_friend" = "follow";
  page?: number;
  limit?: number;
}

export class GetSentRequestsDto {
  type: "follow" | "close_friend" = "follow";
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
  followStatus!: FollowStatus;
  closeFriendStatus!: CloseFriendStatus;
  createdAt!: Date;
  updatedAt!: Date;
}

export class FollowRequestDto {
  id!: string;
  user!: UserMinimalDto; // User who sent the request
  status!: FollowStatus;
  requestedAt!: Date;
}

export class CloseFriendRequestDto {
  id!: string;
  user!: UserMinimalDto; // User who sent the request
  status!: CloseFriendStatus;
  requestedAt!: Date;
}

export class FollowerDto {
  id!: string;
  follower!: UserMinimalDto;
  followStatus!: FollowStatus;
  closeFriendStatus!: CloseFriendStatus;
  followedAt!: Date;
  isFollowingBack!: boolean; // Mutual follow
  relationshipType!: RelationshipType;
}

export class FollowingDto {
  id!: string;
  following!: UserMinimalDto;
  followStatus!: FollowStatus;
  closeFriendStatus!: CloseFriendStatus;
  followedAt!: Date;
  isFollower!: boolean; // Mutual follow
  relationshipType!: RelationshipType;
}

export class FriendDto {
  id!: string;
  user!: UserMinimalDto;
  isCloseFriend!: boolean;
  closeFriendStatus!: CloseFriendStatus;
  friendsSince!: Date; // When mutual follow happened
}

export class CloseFriendDto {
  id!: string;
  user!: UserMinimalDto;
  closeFriendSince!: Date;
}

// ==========================================
// PAGINATED RESPONSE DTOs
// ==========================================

export class PaginationDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
  hasMore!: boolean;
}

export class PaginatedFollowersDto {
  followers!: FollowerDto[];
  pagination!: PaginationDto;
}

export class PaginatedFollowingDto {
  following!: FollowingDto[];
  pagination!: PaginationDto;
}

export class PaginatedFriendsDto {
  friends!: FriendDto[];
  pagination!: PaginationDto;
}

export class PaginatedCloseFriendsDto {
  closeFriends!: CloseFriendDto[];
  pagination!: PaginationDto;
}

export class PaginatedFollowRequestsDto {
  requests!: FollowRequestDto[];
  pagination!: PaginationDto;
}

export class PaginatedCloseFriendRequestsDto {
  requests!: CloseFriendRequestDto[];
  pagination!: PaginationDto;
}

// ==========================================
// STATS DTOs
// ==========================================

export class FollowStatsDto {
  followersCount!: number; // Accepted followers
  followingCount!: number; // Accepted following
  friendsCount!: number; // Mutual follows
  closeFriendsCount!: number;
  pendingFollowRequestsCount!: number; // Received pending requests
  pendingCloseFriendRequestsCount!: number;
}

export class RelationshipStatusDto {
  isFollowing!: boolean; // Current user follows target
  isFollower!: boolean; // Target follows current user
  followStatus?: FollowStatus; // Current user's follow status to target
  followerStatus?: FollowStatus; // Target's follow status to current user
  isFriend!: boolean; // Mutual follow
  isCloseFriend!: boolean;
  closeFriendStatus!: CloseFriendStatus;
  closeFriendRequestedBy?: string; // Who requested close friend
  relationshipType!: RelationshipType;
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
  pagination!: PaginationDto;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

export function determineRelationshipType(
  isFollowing: boolean,
  isFollower: boolean,
  followStatus?: FollowStatus,
  followerStatus?: FollowStatus,
  closeFriendStatus?: CloseFriendStatus
): RelationshipType {
  // Check close friend first
  if (closeFriendStatus === CloseFriendStatus.ACCEPTED) {
    return RelationshipType.CLOSE_FRIEND;
  }

  // Check if both follow each other (accepted)
  const isMutualFollow =
    isFollowing &&
    isFollower &&
    followStatus === FollowStatus.ACCEPTED &&
    followerStatus === FollowStatus.ACCEPTED;

  if (isMutualFollow) {
    return RelationshipType.FRIEND;
  }

  // Check following
  if (isFollowing && followStatus === FollowStatus.ACCEPTED) {
    return RelationshipType.FOLLOWING;
  }

  // Check follower
  if (isFollower && followerStatus === FollowStatus.ACCEPTED) {
    return RelationshipType.FOLLOWER;
  }

  return RelationshipType.NONE;
}
