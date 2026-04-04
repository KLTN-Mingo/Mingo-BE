import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../errors";

export function adminMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if ((req as any).user?.role !== "admin") {
    return next(
      new ForbiddenError("Chỉ admin mới có quyền thực hiện thao tác này")
    );
  }
  next();
}
