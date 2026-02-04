// src/models/refresh-token.model.ts
import { Schema, model, Types } from "mongoose";

const RefreshTokenSchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },

    family: { type: String, required: true, index: true },

    isUsed: { type: Boolean, default: false },
    isRevoked: { type: Boolean, default: false },

    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index → auto delete expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model("RefreshToken", RefreshTokenSchema);
