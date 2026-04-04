"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginatedBlockedUsersDto = exports.BlockedUserDto = exports.BlockResponseDto = exports.GetBlockedUsersDto = exports.UnblockUserDto = exports.BlockUserDto = exports.RelationshipStatusDto = exports.FollowStatsDto = exports.PaginatedCloseFriendRequestsDto = exports.PaginatedFollowRequestsDto = exports.PaginatedCloseFriendsDto = exports.PaginatedFriendsDto = exports.PaginatedFollowingDto = exports.PaginatedFollowersDto = exports.PaginationDto = exports.CloseFriendDto = exports.FriendDto = exports.FollowingDto = exports.FollowerDto = exports.CloseFriendRequestDto = exports.FollowRequestDto = exports.FollowResponseDto = exports.GetSentRequestsDto = exports.GetPendingRequestsDto = exports.GetCloseFriendsDto = exports.GetFriendsDto = exports.GetFollowingDto = exports.GetFollowersDto = exports.RemoveCloseFriendDto = exports.RespondCloseFriendRequestDto = exports.SendCloseFriendRequestDto = exports.CancelFollowRequestDto = exports.UnfollowUserDto = exports.RespondFollowRequestDto = exports.SendFollowRequestDto = exports.RelationshipType = void 0;
exports.determineRelationshipType = determineRelationshipType;
const follow_model_1 = require("../models/follow.model");
// ==========================================
// ENUMS FOR RELATIONSHIP TYPE
// ==========================================
var RelationshipType;
(function (RelationshipType) {
    RelationshipType["NONE"] = "none";
    RelationshipType["FOLLOWER"] = "follower";
    RelationshipType["FOLLOWING"] = "following";
    RelationshipType["FRIEND"] = "friend";
    RelationshipType["CLOSE_FRIEND"] = "close_friend";
})(RelationshipType || (exports.RelationshipType = RelationshipType = {}));
// ==========================================
// FOLLOW REQUEST DTOs
// ==========================================
class SendFollowRequestDto {
}
exports.SendFollowRequestDto = SendFollowRequestDto;
class RespondFollowRequestDto {
}
exports.RespondFollowRequestDto = RespondFollowRequestDto;
class UnfollowUserDto {
}
exports.UnfollowUserDto = UnfollowUserDto;
class CancelFollowRequestDto {
}
exports.CancelFollowRequestDto = CancelFollowRequestDto;
// ==========================================
// CLOSE FRIEND REQUEST DTOs
// ==========================================
class SendCloseFriendRequestDto {
}
exports.SendCloseFriendRequestDto = SendCloseFriendRequestDto;
class RespondCloseFriendRequestDto {
}
exports.RespondCloseFriendRequestDto = RespondCloseFriendRequestDto;
class RemoveCloseFriendDto {
}
exports.RemoveCloseFriendDto = RemoveCloseFriendDto;
// ==========================================
// QUERY DTOs
// ==========================================
class GetFollowersDto {
}
exports.GetFollowersDto = GetFollowersDto;
class GetFollowingDto {
}
exports.GetFollowingDto = GetFollowingDto;
class GetFriendsDto {
}
exports.GetFriendsDto = GetFriendsDto;
class GetCloseFriendsDto {
}
exports.GetCloseFriendsDto = GetCloseFriendsDto;
class GetPendingRequestsDto {
    constructor() {
        this.type = "follow";
    }
}
exports.GetPendingRequestsDto = GetPendingRequestsDto;
class GetSentRequestsDto {
    constructor() {
        this.type = "follow";
    }
}
exports.GetSentRequestsDto = GetSentRequestsDto;
// ==========================================
// FOLLOW RESPONSE DTOs
// ==========================================
class FollowResponseDto {
}
exports.FollowResponseDto = FollowResponseDto;
class FollowRequestDto {
}
exports.FollowRequestDto = FollowRequestDto;
class CloseFriendRequestDto {
}
exports.CloseFriendRequestDto = CloseFriendRequestDto;
class FollowerDto {
}
exports.FollowerDto = FollowerDto;
class FollowingDto {
}
exports.FollowingDto = FollowingDto;
class FriendDto {
}
exports.FriendDto = FriendDto;
class CloseFriendDto {
}
exports.CloseFriendDto = CloseFriendDto;
// ==========================================
// PAGINATED RESPONSE DTOs
// ==========================================
class PaginationDto {
}
exports.PaginationDto = PaginationDto;
class PaginatedFollowersDto {
}
exports.PaginatedFollowersDto = PaginatedFollowersDto;
class PaginatedFollowingDto {
}
exports.PaginatedFollowingDto = PaginatedFollowingDto;
class PaginatedFriendsDto {
}
exports.PaginatedFriendsDto = PaginatedFriendsDto;
class PaginatedCloseFriendsDto {
}
exports.PaginatedCloseFriendsDto = PaginatedCloseFriendsDto;
class PaginatedFollowRequestsDto {
}
exports.PaginatedFollowRequestsDto = PaginatedFollowRequestsDto;
class PaginatedCloseFriendRequestsDto {
}
exports.PaginatedCloseFriendRequestsDto = PaginatedCloseFriendRequestsDto;
// ==========================================
// STATS DTOs
// ==========================================
class FollowStatsDto {
}
exports.FollowStatsDto = FollowStatsDto;
class RelationshipStatusDto {
}
exports.RelationshipStatusDto = RelationshipStatusDto;
// ==========================================
// BLOCK DTOs
// ==========================================
class BlockUserDto {
}
exports.BlockUserDto = BlockUserDto;
class UnblockUserDto {
}
exports.UnblockUserDto = UnblockUserDto;
class GetBlockedUsersDto {
}
exports.GetBlockedUsersDto = GetBlockedUsersDto;
class BlockResponseDto {
}
exports.BlockResponseDto = BlockResponseDto;
class BlockedUserDto {
}
exports.BlockedUserDto = BlockedUserDto;
class PaginatedBlockedUsersDto {
}
exports.PaginatedBlockedUsersDto = PaginatedBlockedUsersDto;
// ==========================================
// HELPER FUNCTIONS
// ==========================================
function determineRelationshipType(isFollowing, isFollower, followStatus, followerStatus, closeFriendStatus) {
    // Check close friend first
    if (closeFriendStatus === follow_model_1.CloseFriendStatus.ACCEPTED) {
        return RelationshipType.CLOSE_FRIEND;
    }
    // Check if both follow each other (accepted)
    const isMutualFollow = isFollowing &&
        isFollower &&
        followStatus === follow_model_1.FollowStatus.ACCEPTED &&
        followerStatus === follow_model_1.FollowStatus.ACCEPTED;
    if (isMutualFollow) {
        return RelationshipType.FRIEND;
    }
    // Check following
    if (isFollowing && followStatus === follow_model_1.FollowStatus.ACCEPTED) {
        return RelationshipType.FOLLOWING;
    }
    // Check follower
    if (isFollower && followerStatus === follow_model_1.FollowStatus.ACCEPTED) {
        return RelationshipType.FOLLOWER;
    }
    return RelationshipType.NONE;
}
