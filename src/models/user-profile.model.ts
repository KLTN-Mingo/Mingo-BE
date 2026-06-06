// src/models/user-profile.model.ts
import { Schema, model, Document, Types } from "mongoose";
import type { ProfileScoreEntry } from "../utils/profile-score.util";

export type IProfileScoreEntry = ProfileScoreEntry;

export interface IUserProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;

  topicScores: Map<string, IProfileScoreEntry>;
  hashtagScores: Map<string, IProfileScoreEntry>;
  authorScores: Map<string, IProfileScoreEntry>;

  interactionCount: number;
  avgSessionDuration?: number;
  preferredContentType?: "image" | "video" | "text";

  updatedAt: Date;
}

const ProfileScoreEntrySchema = new Schema<IProfileScoreEntry>(
  {
    score: { type: Number, required: true, default: 0 },
    lastUpdatedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

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
      of: ProfileScoreEntrySchema,
      default: new Map(),
    },
    hashtagScores: {
      type: Map,
      of: ProfileScoreEntrySchema,
      default: new Map(),
    },
    authorScores: {
      type: Map,
      of: ProfileScoreEntrySchema,
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
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

export const UserProfileModel = model<IUserProfile>(
  "UserProfile",
  UserProfileSchema
);
