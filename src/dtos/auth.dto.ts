// src/dtos/auth.dto.ts

// ─── Request DTOs ──────────────────────────────────────────────────────────────

export interface RegisterDto {
  /** Bắt buộc trừ khi chỉ đăng ký bằng email (sẽ tạo phone nội bộ) */
  phoneNumber?: string;
  email?: string;
  password: string;
  name?: string;
}

export interface LoginDto {
  phoneNumber?: string;
  email?: string;
  password: string;
}

// ─── Response DTOs ─────────────────────────────────────────────────────────────

export interface AuthUserDto {
  id: string;
  phoneNumber: string;
  email?: string;
  name?: string;
  avatar?: string;
  role: string;
  verified: boolean;
}

export interface AuthResponseDto {
  accessToken: string;
  user: AuthUserDto;
}

// ─── Mapper ────────────────────────────────────────────────────────────────────

import type { IUser } from "../models/user.model";

export function toAuthUser(user: IUser): AuthUserDto {
  return {
    id: user._id.toString(),
    phoneNumber: user.phoneNumber,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
    verified: user.verified,
  };
}
