// src/models/user-profile.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IUserProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;

  topicScores: Map<string, number>;
  hashtagScores: Map<string, number>;
  authorScores: Map<string, number>;

  interactionCount: number;
  avgSessionDuration?: number;
  preferredContentType?: "image" | "video" | "text";

  lastCalculatedAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    topicScores: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    hashtagScores: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    authorScores: {
      type: Map,
      of: Number,
      default: new Map(),
    },

    interactionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgSessionDuration: {
      type: Number,
      min: 0,
    },
    preferredContentType: {
      type: String,
      enum: ["image", "video", "text"],
    },

    lastCalculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

UserProfileSchema.index({ userId: 1 });
UserProfileSchema.index({ lastCalculatedAt: 1 });

export const UserProfileModel = model<IUserProfile>(
  "UserProfile",
  UserProfileSchema
);