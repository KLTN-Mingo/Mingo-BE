// src/scripts/seed-slang-dictionary.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mongoose from "mongoose";
import { SlangEntryModel } from "../models/culture-translation.model";

const SAMPLE_SLANG = [
  {
    term: "noob",
    aliases: ["newbie", "nub"],
    regexPattern: "\\b(noob|newbie|nub)s?\\b",
    category: "Gaming",
  },
  {
    term: "flex",
    aliases: [],
    regexPattern: "\\bflex(ing)?\\b",
    category: "Gen Z",
  },
  {
    term: "ib4l",
    aliases: ["ib4ll"],
    regexPattern: "\\bib4l{1,}\\b",
    category: "Gen Z",
  },
  {
    term: "chill",
    aliases: [],
    regexPattern: "\\bchill(ing|ed)?\\b",
    category: "Chung",
  },
  {
    term: "gank",
    aliases: [],
    regexPattern: "\\bgank(ed|ing)?\\b",
    category: "Gaming",
  },
  {
    term: "toxic",
    aliases: [],
    regexPattern: "\\btoxic\\b",
    category: "Gaming",
  },
  {
    term: "ghosting",
    aliases: ["ghost"],
    regexPattern: "\\bghost(ing|ed)?\\b",
    category: "Gen Z",
  },
  {
    term: "simp",
    aliases: ["simping"],
    regexPattern: "\\bsimp(ing|ed|s)?\\b",
    category: "Gen Z",
  },
  {
    term: "fomo",
    aliases: [],
    regexPattern: "\\bfomo\\b",
    category: "Gen Z",
  },
  {
    term: "sus",
    aliases: [],
    regexPattern: "\\bsus\\b",
    category: "Gaming",
  },
];

async function seed() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI không được cấu hình trong .env.local");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI, { tls: true });
  console.log("Connected to MongoDB");

  for (const data of SAMPLE_SLANG) {
    await SlangEntryModel.findOneAndUpdate(
      { term: data.term },
      data,
      { upsert: true, new: true }
    );
    console.log(`✅ Seeded: ${data.term}`);
  }

  await mongoose.disconnect();
  console.log("Done. Disconnected.");
}

seed().catch(console.error);
