import type { Request } from "express";
import { AuditLogModel } from "../models/audit-log.model";

export interface AuditContext {
  statusCode: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

const REDACT_KEYS = new Set([
  "password",
  "passwordHash",
  "accessToken",
  "refreshToken",
  "token",
  "authorization",
  "cookie",
  "jwt",
  "secret",
]);

function sanitizeUnknown(value: unknown, depth: number = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 4) return "[Truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizeUnknown(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const lowered = key.toLowerCase();
      if (REDACT_KEYS.has(lowered)) {
        out[key] = "[REDACTED]";
        continue;
      }
      out[key] = sanitizeUnknown(raw, depth + 1);
    }
    return out;
  }

  if (typeof value === "string") {
    return value.length > 1000 ? `${value.slice(0, 1000)}...[Truncated]` : value;
  }

  return value;
}

function sanitizeRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  return sanitizeUnknown(value) as Record<string, unknown>;
}

function parseTarget(req: Request): { entityType?: string; entityId?: string } {
  const entityId =
    typeof req.params?.id === "string"
      ? req.params.id
      : typeof req.params?.postId === "string"
      ? req.params.postId
      : typeof req.params?.commentId === "string"
      ? req.params.commentId
      : undefined;

  const pathParts = req.path.split("/").filter(Boolean);
  const entityType = pathParts.length > 0 ? pathParts[0] : undefined;

  return { entityType, entityId };
}

function toModule(req: Request): string {
  const parts = req.baseUrl.split("/").filter(Boolean);
  if (parts.length >= 2) return parts[1];
  if (parts.length === 1) return parts[0];
  const pathParts = req.path.split("/").filter(Boolean);
  return pathParts[0] ?? "unknown";
}

function toAction(req: Request): string {
  const parts = req.path.split("/").filter(Boolean).slice(0, 3);
  const normalizedPath = parts.join("_") || "root";
  return `${req.method.toLowerCase()}_${normalizedPath}`;
}

function routePattern(req: Request): string | undefined {
  const routePath = (req.route as { path?: string } | undefined)?.path;
  if (!routePath) return undefined;
  return `${req.baseUrl || ""}${routePath}`;
}

class AuditLogService {
  async logRequest(req: Request, context: AuditContext): Promise<void> {
    const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
    const { entityType, entityId } = parseTarget(req);

    await AuditLogModel.create({
      action: toAction(req),
      module: toModule(req),
      actor: {
        ...(actor?.userId && { userId: actor.userId }),
        ...(actor?.role && { role: actor.role }),
      },
      target: {
        ...(entityType && { entityType }),
        ...(entityId && { entityId }),
      },
      request: {
        method: req.method,
        path: req.originalUrl,
        routePattern: routePattern(req),
        ip: req.ip,
        userAgent: req.get("user-agent") || undefined,
        requestId: req.get("x-request-id") || undefined,
        params: sanitizeRecord(req.params),
        query: sanitizeRecord(req.query),
        body: sanitizeRecord(req.body),
      },
      response: {
        statusCode: context.statusCode,
        success: context.statusCode >= 200 && context.statusCode < 400,
        durationMs: context.durationMs,
      },
      metadata: context.metadata,
    });
  }
}

export const auditLogService = new AuditLogService();
