// src/utils/response.ts
import type { Response } from "express";
import { AppError } from "../errors";

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface SuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  timestamp: string; // ISO string - dễ serialize hơn Date
}

export interface PaginatedResponse<T = unknown> {
  success: true;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string; // e.g. "VALIDATION_ERROR"
    message: string; // human-readable
    details?: unknown; // validation errors, stack (dev only), ...
  };
  timestamp: string;
}

// ─── Builder functions (trả về plain object, không gắn với Express) ────────────

export function buildSuccess<T>(
  data: T,
  message: string = "Thành công"
): SuccessResponse<T> {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function buildPaginated<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number },
  message: string = "Thành công"
): PaginatedResponse<T> {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    message,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
    timestamp: new Date().toISOString(),
  };
}

export function buildError(
  code: string,
  message: string,
  details?: unknown
): ErrorResponse {
  return {
    success: false,
    error: { code, message, details },
    timestamp: new Date().toISOString(),
  };
}

// ─── Express response helpers (gắn res.status().json() luôn) ──────────────────

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): void {
  res.status(statusCode).json(buildSuccess(data, message));
}

export function sendCreated<T>(
  res: Response,
  data: T,
  message: string = "Tạo mới thành công"
): void {
  res.status(201).json(buildSuccess(data, message));
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: { page: number; limit: number; total: number },
  message?: string
): void {
  res.status(200).json(buildPaginated(data, pagination, message));
}

/**
 * Gửi error response từ AppError - dùng trong error middleware
 */
export function sendError(
  res: Response,
  error: AppError,
  details?: unknown
): void {
  res
    .status(error.statusCode)
    .json(buildError(error.errorCode, error.message, details));
}
