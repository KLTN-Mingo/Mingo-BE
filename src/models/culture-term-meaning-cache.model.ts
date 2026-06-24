import { Document, model, Schema } from "mongoose";
import type { ICultureTerm } from "./culture-translation.model";

export interface ICultureTermMeaningCache extends Document {
  term: string;
  meaning: string;
  origin: string;
  tone: ICultureTerm["tone"];
  contextNote: string;
  source: "gemini";
  hitCount: number;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CultureTermMeaningCacheSchema = new Schema<ICultureTermMeaningCache>(
  {
    term: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    meaning: { type: String, required: true, trim: true },
    origin: { type: String, default: "", trim: true },
    tone: { type: String, default: "trung tính" },
    contextNote: { type: String, default: "", trim: true },
    source: {
      type: String,
      enum: ["gemini"],
      default: "gemini",
    },
    hitCount: { type: Number, default: 0, min: 0 },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CultureTermMeaningCacheSchema.index({ term: 1 }, { unique: true });
CultureTermMeaningCacheSchema.index({ lastUsedAt: -1 });

export const CultureTermMeaningCacheModel = model<ICultureTermMeaningCache>(
  "CultureTermMeaningCache",
  CultureTermMeaningCacheSchema
);
