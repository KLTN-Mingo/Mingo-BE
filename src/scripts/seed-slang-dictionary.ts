// src/scripts/seed-slang-dictionary.ts
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

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
  {
    term: "anh tôi đó",
    aliases: ["anh toi do", "anh trai tôi đó", "anh tôi"],
    regexPattern: "\\banh\\s+t(?:ô|o)i\\s+đ(?:ó|o)\\b",
    category: "Gen Z",
  },
  {
    term: "xà lơ",
    aliases: ["xa lo", "ăn nói xà lơ", "sà lơ"],
    regexPattern: "\\b(?:x|s)[aà]\\s*l[oơ]\\b",
    category: "Gen Z",
  },
  {
    term: "báo thủ",
    aliases: ["báo", "bao thu"],
    regexPattern: "\\bb[aá]o\\s*(th[uủ])?\\b",
    category: "Gaming",
  },
  {
    term: "mỏ hỗn",
    aliases: ["mo hon", "hỗn"],
    regexPattern: "\\bm[oỏ]\\s*h[oỗ]n\\b",
    category: "Gen Z",
  },
  {
    term: "cảm lạnh",
    aliases: ["cam lanh"],
    regexPattern: "\\bc[aả]m\\s*l[aạ]nh\\b",
    category: "Gen Z",
  },
  {
    term: "suy",
    aliases: ["suy tình", "suy vl"],
    regexPattern: "\\bsuy\\b",
    category: "Gen Z",
  },
  {
    term: "ao chình",
    aliases: ["out trình", "outplay", "out trinh"],
    regexPattern: "\\b(ao|out)\\s*(ch[iì]nh|tr[iì]nh)\\b",
    category: "Gaming",
  },
  {
    term: "xu cà na",
    aliases: ["xu", "xu ca na"],
    regexPattern: "\\bxu\\s*(c[aà]\\s*na)?\\b",
    category: "Gen Z",
  },
  {
    term: "chằm zn",
    aliases: ["trầm cảm", "cham zn"],
    regexPattern: "\\bch[aằ]m\\s*zn\\b",
    category: "Gen Z",
  },
  {
    term: "thao túng tâm lý",
    aliases: ["gaslight", "thao tung tam ly"],
    regexPattern: "\\b(thao\\s*t[uú]ng|gaslight(ing|ed)?)\\b",
    category: "Chung",
  },
  {
    term: "ô dề",
    aliases: ["o de", "làm quá"],
    regexPattern: "\\b[oô]\\s*d[eề]\\b",
    category: "Gen Z",
  },
  {
    term: "trẻ trâu",
    aliases: ["tre trau", "trẩu", "trẩu tre"],
    regexPattern: "\\b(tr[eẻ]\\s*tr[aâ]u|tr[aẩ]u(\\s*tre)?)\\b",
    category: "Gaming",
  },
  {
    term: "hài hước mà tưởng mình vô duyên",
    aliases: [
      "hai huoc ma tuong minh vo duyen",
      "vô duyên mà tưởng mình hài hước",
      "hài hước mà tưởng mình vô duyên",
      "tưởng mình hài hước",
    ],
    // Bắt chéo cả 2 chiều: "hài hước mà tưởng vô duyên" hoặc "vô duyên tưởng hài hước"
    regexPattern:
      "\\b(?:h[aà]i\\s+h[ưứ]ớc|v[ôo]\\s+duy[êe]n)\\s+m[aà]\\s+t[ưự]ởng(\\s+m[iì]nh)?\\s+(?:v[ôo]\\s+duy[êe]n|h[aà]i\\s+h[ưứ]ớc)\\b",
    category: "TikTok",
  },
  {
    term: "cổ điển, tôn trọng",
    aliases: [
      "co dien ton trong",
      "cổ điển tôn trọng",
      "rất cổ điển rất tôn trọng",
    ],
    regexPattern: "\\bc[ổo]\\s+đ[iị][êệ]n\\s*,?\\s*t[ôo]n\\s+tr[ọo]ng\\b",
    category: "TikTok",
  },
  {
    term: "đi làm công ty không tao xin cho",
    aliases: [
      "di lam cong ty khong t xin cho",
      "đi làm công ty không t xin cho",
      "không đi làm công ty t xin cho",
      "đi làm công ty đi tao xin cho",
    ],
    // Hỗ trợ bắt cả "không t xin cho", "đi t xin cho" và thay thế t/tao
    regexPattern:
      "\\bđ[iì]\\s+l[aà]m\\s+c[ôo]ng\\s+ty\\s+(?:kh[ôo]ng|đ[iì])\\s+(?:t|t[aã]o)\\s+xin\\s+cho\\b",
    category: "TikTok",
  },
  {
    term: "nói như vậy thì ok đi",
    aliases: [
      "noi nhu vay thi ok di",
      "nói như thế thì ok đi",
      "nói như vậy thì okđ",
      "nói thế thì ok đi",
    ],
    // Catch được các biến thể "[ABC] nói như vậy/như thế thì ok đi"
    regexPattern:
      "\\bn[oó]i\\s+nh[ưư]\\s+(?:v[ậa]y|th[ếe])\\s+th[iì]\\s+ok\\s+đ[iì]\\b",
    category: "TikTok",
  },
  {
    term: "nhiệm vụ hệ thống ngày càng khó",
    aliases: [
      "nhiem vu he thong ngay cang kho",
      "nhiệm vụ hệ thống",
      "nhiem vu he thong",
      "nvht ngày càng khó",
    ],
    // Bắt từ khóa gốc "nhiệm vụ hệ thống" hoặc viết tắt kiểu game thủ "nvht"
    regexPattern: "\\b(?:nh[iị][êệ]m\\s+v[ụu]\\s+h[ệe]\\s+th[ốo]ng|nvht)\\b",
    category: "TikTok",
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
    await SlangEntryModel.findOneAndUpdate({ term: data.term }, data, {
      upsert: true,
      new: true,
    });
    console.log(`✅ Seeded: ${data.term}`);
  }

  await mongoose.disconnect();
  console.log("Done. Disconnected.");
}

seed().catch(console.error);
