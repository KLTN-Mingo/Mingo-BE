// src/dtos/user.dto.ts
import { Gender, UserRole } from "../models/user.model";
import type { IUser } from "../models/user.model";

// ─── Request DTOs ──────────────────────────────────────────────────────────────

export interface UpdateProfileDto {
  name?: string;
  bio?: string;
  avatar?: string;
  backgroundUrl?: string;
  dateOfBirth?: string; // ISO string từ client, parse thành Date trong controller
  gender?: Gender;
}

export interface GetUsersQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  isBlocked?: boolean;
}

// ─── Response DTOs ─────────────────────────────────────────────────────────────

/**
 * Minimal info - dùng để nhúng trong các entity khác
 * (post author, comment author, mention, like, v.v.)
 */
export interface UserMinimalDto {
  id: string;
  name?: string;
  avatar?: string;
  verified: boolean;
}

/** Public profile - dùng khi xem profile người khác */
export interface PublicUserDto {
  id: string;
  name?: string;
  bio?: string;
  avatar?: string;
  backgroundUrl?: string;
  gender?: Gender;
  verified: boolean;
  onlineStatus: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: Date;
}

/** Profile đầy đủ - dùng cho /me */
export interface UserProfileDto {
  id: string;
  phoneNumber: string;
  email?: string;
  name?: string;
  bio?: string;
  avatar?: string;
  backgroundUrl?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  role: UserRole;
  verified: boolean;
  twoFactorEnabled: boolean;
  isActive: boolean;
  isBlocked: boolean;
  onlineStatus: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Summary - dùng trong danh sách (admin) */
export interface UserSummaryDto {
  id: string;
  phoneNumber: string;
  email?: string;
  name?: string;
  avatar?: string;
  role: UserRole;
  verified: boolean;
  isActive: boolean;
  isBlocked: boolean;
  onlineStatus: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  lastLogin?: Date;
  createdAt: Date;
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

export function toUserMinimal(user: IUser): UserMinimalDto {
  return {
    id: user._id.toString(),
    name: user.name,
    avatar: user.avatar,
    verified: user.verified,
  };
}

export function toPublicUser(user: IUser): PublicUserDto {
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

export function toUserProfile(user: IUser): UserProfileDto {
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

export function toUserSummary(user: IUser): UserSummaryDto {
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
