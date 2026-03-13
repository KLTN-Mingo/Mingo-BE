"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toUserMinimal = toUserMinimal;
exports.toPublicUser = toPublicUser;
exports.toUserProfile = toUserProfile;
exports.toUserSummary = toUserSummary;
// ─── Mappers ───────────────────────────────────────────────────────────────────
function toUserMinimal(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        avatar: user.avatar,
        verified: user.verified,
    };
}
function toPublicUser(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        bio: user.bio,
        avatar: user.avatar,
        backgroundUrl: user.backgroundUrl,
        gender: user.gender,
        verified: user.verified,
        onlineStatus: user.onlineStatus,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        postsCount: user.postsCount,
        createdAt: user.createdAt,
    };
}
function toUserProfile(user) {
    return {
        id: user._id.toString(),
        phoneNumber: user.phoneNumber,
        email: user.email,
        name: user.name,
        bio: user.bio,
        avatar: user.avatar,
        backgroundUrl: user.backgroundUrl,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        role: user.role,
        verified: user.verified,
        twoFactorEnabled: user.twoFactorEnabled,
        isActive: user.isActive,
        isBlocked: user.isBlocked,
        onlineStatus: user.onlineStatus,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        postsCount: user.postsCount,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}
function toUserSummary(user) {
    return {
        id: user._id.toString(),
        phoneNumber: user.phoneNumber,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        verified: user.verified,
        isActive: user.isActive,
        isBlocked: user.isBlocked,
        onlineStatus: user.onlineStatus,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        postsCount: user.postsCount,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
    };
}
