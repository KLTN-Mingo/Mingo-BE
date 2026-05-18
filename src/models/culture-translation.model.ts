// src/models/culture-translation.model.ts
import { Schema, model, Document, Types } from "mongoose";

// Sub-schema embedded in Post (no separate _id)
export interface ICultureTerm {
  term: string;
  startIndex: number;   // char offset in contentText
  endIndex: number;
  meaning: string;
  origin: string;
  tone: "tích cực" | "trung tính" | "hài hước" | "tiêu cực";
  contextNote: string;
}

export const CultureTermSchema = new Schema<ICultureTerm>(
  {
    term:        { type: String, required: true },
    startIndex:  { type: Number, required: true },
    endIndex:    { type: Number, required: true },
    meaning:     { type: String, default: "" },
    origin:      { type: String, default: "" },
    tone: {
      type: String,
      enum: ["tích cực", "trung tính", "hài hước", "tiêu cực"],
      default: "trung tính",
    },
    contextNote: { type: String, default: "" },
  },
  { _id: false }
);

// Slang dictionary collection — Admin manages
export interface ISlangEntry extends Document {
  _id: Types.ObjectId;
  term: string;          // canonical lowercase: "noob", "ib4l", "flex"
  aliases: string[];    // variants: ["ib4ll", "ib4l..."]
  regexPattern: string;  // "\\bib4l{1,}\\b"
  category: string;      // "Gen Z" | "Gaming" | "Crypto" | "Chung"
  isActive: boolean;
  reportCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const SlangEntrySchema = new Schema<ISlangEntry>(
  {
    term:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    aliases:      { type: [String], default: [] },
    regexPattern: { type: String, required: true },
    category:     { type: String, default: "Chung" },
    isActive:     { type: Boolean, default: true, index: true },
    reportCount:  { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

SlangEntrySchema.index({ term: 1 });

export const SlangEntryModel = model<ISlangEntry>("SlangEntry", SlangEntrySchema);
