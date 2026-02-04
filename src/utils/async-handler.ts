// src/utils/async-handler.ts
import { Request, Response, NextFunction } from "express";

/**
 * Wrapper function để tự động bắt lỗi cho async controller
 * Thay vì try-catch trong mỗi controller, chỉ cần wrap controller bằng asyncHandler
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
