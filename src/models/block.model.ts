// src/models/block.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IBlock extends Document {
  _id: Types.ObjectId;
  blockerId: Types.ObjectId;
  blockedId: Types.ObjectId;
  reason?: string;
  createdAt: Date;
}

const BlockSchema = new Schema<IBlock>(
  {
    blockerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blockedId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound unique index to prevent duplicate blocks
BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export const BlockModel = model<IBlock>("Block", BlockSchema);
