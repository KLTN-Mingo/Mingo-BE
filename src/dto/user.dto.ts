// src/dtos/user.dto.ts
import { Gender, UserRole } from "../models/user.model";

// ==========================================
// REQUEST DTOs
// ==========================================

export class RegisterUserDto {
  phoneNumber!: string;
  password!: string;
  name?: string;
  email?: string;
}

export class LoginUserDto {
  phoneNumber!: string;
  password!: string;
}

export class UpdateProfileDto {
  name?: string;
  bio?: string;
  avatar?: string;
  backgroundUrl?: string;
  dateOfBirth?: Date;
  gender?: Gender;
}

export class ChangePasswordDto {
  currentPassword!: string;
  newPassword!: string;
}

export class Enable2FADto {
  token!: string; // OTP token for verification
}

export class Verify2FADto {
  token!: string; // OTP token
}

export class GoogleAuthDto {
  googleId!: string;
  email!: string;
  name!: string;
  picture?: string;
}

export class SearchUsersDto {
  query!: string;
  page?: number;
  limit?: number;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

export class UserResponseDto {
  id!: string;
  phoneNumber!: string;
  email?: string;
  name?: string;
  bio?: string;
  avatar?: string;
  backgroundUrl?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  role!: UserRole;
  verified!: boolean;
  twoFactorEnabled!: boolean;
  followersCount!: number;
  followingCount!: number;
  postsCount!: number;
  isActive!: boolean;
  onlineStatus!: boolean;
  lastLogin?: Date;
  createdAt!: Date;
  updatedAt!: Date;
}

export class UserProfileDto {
  id!: string;
  phoneNumber!: string;
  name?: string;
  bio?: string;
  avatar?: string;
  backgroundUrl?: string;
  followersCount!: number;
  followingCount!: number;
  postsCount!: number;
  isFollowing?: boolean;
  isBlocked?: boolean;
  createdAt!: Date;
}

export class UserMinimalDto {
  id!: string;
  name?: string;
  avatar?: string;
  verified?: boolean;
}

export class AuthResponseDto {
  accessToken!: string;
  refreshToken?: string;
  user!: UserResponseDto;
}

export class Enable2FAResponseDto {
  secret!: string;
  qrCode!: string;
}

export class UserStatsDto {
  followersCount!: number;
  followingCount!: number;
  postsCount!: number;
}

// ==========================================
// PAGINATION DTO
// ==========================================

export class PaginatedUsersDto {
  users!: UserProfileDto[];
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}
