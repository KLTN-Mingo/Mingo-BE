import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess } from "../utils/response";
import { ValidationError } from "../errors";
import { AuditLogModel } from "../models/audit-log.model";

function toPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseDate(raw: string | undefined, field: string): Date | undefined {
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} không hợp lệ`);
  }
  return date;
}

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const page = toPositiveInt(req.query.page as string | undefined, 1);
  const limit = Math.min(toPositiveInt(req.query.limit as string | undefined, 20), 100);
  const skip = (page - 1) * limit;

  const actorUserId = (req.query.actorUserId as string | undefined)?.trim();
  const method = (req.query.method as string | undefined)?.trim().toUpperCase();
  const action = (req.query.action as string | undefined)?.trim();
  const module = (req.query.module as string | undefined)?.trim();
  const pathKeyword = (req.query.path as string | undefined)?.trim();

  const statusCodeRaw = (req.query.statusCode as string | undefined)?.trim();
  const from = parseDate((req.query.from as string | undefined)?.trim(), "from");
  const to = parseDate((req.query.to as string | undefined)?.trim(), "to");

  if (from && to && from > to) {
    throw new ValidationError("from không được lớn hơn to");
  }

  const filter: Record<string, unknown> = {};

  if (actorUserId) {
    filter["actor.userId"] = actorUserId;
  }
  if (method) {
    filter["request.method"] = method;
  }
  if (action) {
    filter.action = action;
  }
  if (module) {
    filter.module = module;
  }
  if (pathKeyword) {
    filter["request.path"] = { $regex: pathKeyword, $options: "i" };
  }
  if (statusCodeRaw) {
    const statusCode = Number(statusCodeRaw);
    if (!Number.isFinite(statusCode)) {
      throw new ValidationError("statusCode không hợp lệ");
    }
    filter["response.statusCode"] = statusCode;
  }
  if (from || to) {
    filter.createdAt = {
      ...(from && { $gte: from }),
      ...(to && { $lte: to }),
    };
  }

  const [logs, total] = await Promise.all([
    AuditLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLogModel.countDocuments(filter),
  ]);

  sendSuccess(res, {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  });
});
