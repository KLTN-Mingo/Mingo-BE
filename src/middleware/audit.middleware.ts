import type { NextFunction, Request, Response } from "express";
import { auditLogService } from "../services/audit-log.service";

function truncateLogValue(value: unknown, maxLength = 2000): string {
  try {
    const text =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);

    if (!text) return "";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}... [truncated]`;
  } catch {
    return "[unserializable response]";
  }
}

function shouldSkipAudit(req: Request): boolean {
  if (!req.originalUrl.startsWith("/api/")) return true;

  const skipPrefixes = ["/api/admin/audit-logs"];
  return skipPrefixes.some((prefix) => req.originalUrl.startsWith(prefix));
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (shouldSkipAudit(req)) {
    next();
    return;
  }

  const start = Date.now();
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let responseBody: unknown;

  res.json = ((body: unknown) => {
    responseBody = body;
    return originalJson(body as never);
  }) as Response["json"];

  res.send = ((body?: unknown) => {
    responseBody = body;
    return originalSend(body as never);
  }) as Response["send"];

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const responseText = truncateLogValue(responseBody);

    console.log(
      `[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`
    );

    if (responseText) {
      console.log(`[API] response: ${responseText}`);
    }

    void auditLogService.logRequest(req, {
      statusCode: res.statusCode,
      durationMs,
    }).catch((error) => {
      console.error("[AuditMiddleware] failed to persist audit log:", error);
    });
  });

  next();
}
