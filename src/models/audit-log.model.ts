import { Document, Schema, Types, model } from "mongoose";

export interface IAuditActor {
  userId?: Types.ObjectId;
  role?: string;
}

export interface IAuditTarget {
  entityType?: string;
  entityId?: string;
}

export interface IAuditRequest {
  method: string;
  path: string;
  routePattern?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

export interface IAuditResponse {
  statusCode: number;
  success: boolean;
  durationMs: number;
}

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  action: string;
  module: string;
  actor?: IAuditActor;
  target?: IAuditTarget;
  request: IAuditRequest;
  response: IAuditResponse;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    actor: {
      userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
      role: { type: String },
    },
    target: {
      entityType: { type: String, index: true },
      entityId: { type: String, index: true },
    },
    request: {
      method: { type: String, required: true, index: true },
      path: { type: String, required: true, index: true },
      routePattern: { type: String },
      ip: { type: String },
      userAgent: { type: String },
      requestId: { type: String },
      params: { type: Schema.Types.Mixed },
      query: { type: Schema.Types.Mixed },
      body: { type: Schema.Types.Mixed },
    },
    response: {
      statusCode: { type: Number, required: true, index: true },
      success: { type: Boolean, required: true, index: true },
      durationMs: { type: Number, required: true },
    },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ "actor.userId": 1, createdAt: -1 });
AuditLogSchema.index({ module: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

const ttlDaysRaw = process.env.AUDIT_LOG_TTL_DAYS;
const ttlDays = ttlDaysRaw ? Number(ttlDaysRaw) : 365;
if (Number.isFinite(ttlDays) && ttlDays > 0) {
  AuditLogSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: Math.floor(ttlDays * 24 * 60 * 60) }
  );
}

export const AuditLogModel = model<IAuditLog>("AuditLog", AuditLogSchema);
