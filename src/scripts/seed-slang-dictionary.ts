// src/scripts/seed-slang-dictionary.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mongoose from "mongoose";
import { SlangEntryModel } from "../models/culture-translation.model";

const SAMPLE_SLANG = [
  // ── Gaming ────────────────────────────────────────────────────────────────
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

  // ── Gen Z Tiếng Anh ───────────────────────────────────────────────────────
  {
    term: "slay",
    aliases: ["slaying"],
    regexPattern: "\\bslay(ing)?\\b",
    category: "Gen Z",
  },
  {
    term: "vibe",
    aliases: ["vibing", "vibes"],
    regexPattern: "\\bvibe(s|ing)?\\b",
    category: "Gen Z",
  },
  {
    term: "no cap",
    aliases: ["nocap"],
    regexPattern: "\\bno\\s?cap\\b",
    category: "Gen Z",
  },
  {
    term: "lowkey",
    aliases: ["low key"],
    regexPattern: "\\blow[\\s-]?key\\b",
    category: "Gen Z",
  },
  {
    term: "highkey",
    aliases: ["high key"],
    regexPattern: "\\bhigh[\\s-]?key\\b",
    category: "Gen Z",
  },
  {
    term: "bussin",
    aliases: ["bussing"],
    regexPattern: "\\bbussin(g)?\\b",
    category: "Gen Z",
  },
  {
    term: "based",
    aliases: [],
    regexPattern: "\\bbased\\b",
    category: "Gen Z",
  },
  {
    term: "cringe",
    aliases: ["cringy"],
    regexPattern: "\\bcringe?(y)?\\b",
    category: "Gen Z",
  },
  {
    term: "mid",
    aliases: [],
    regexPattern: "\\bmid\\b",
    category: "Gen Z",
  },
  {
    term: "rizz",
    aliases: ["rizzed"],
    regexPattern: "\\brizz(ed)?\\b",
    category: "Gen Z",
  },
  {
    term: "ratio",
    aliases: ["ratioed"],
    regexPattern: "\\bratio(ed)?\\b",
    category: "Gen Z",
  },
  {
    term: "ngl",
    aliases: ["not gonna lie"],
    regexPattern: "\\bngl\\b",
    category: "Gen Z",
  },
  {
    term: "iykyk",
    aliases: ["if you know you know"],
    regexPattern: "\\biykyk\\b",
    category: "Gen Z",
  },
  {
    term: "tbh",
    aliases: ["to be honest"],
    regexPattern: "\\btbh\\b",
    category: "Gen Z",
  },
  {
    term: "periodt",
    aliases: ["period"],
    regexPattern: "\\bperiod[t]?\\b",
    category: "Gen Z",
  },
  {
    term: "main character",
    aliases: ["main character energy"],
    regexPattern: "\\bmain\\s+character(\\s+energy)?\\b",
    category: "Gen Z",
  },
  {
    term: "glow up",
    aliases: ["glowup"],
    regexPattern: "\\bglow[\\s-]?up\\b",
    category: "Gen Z",
  },

  // ── Gen Z Tiếng Việt (cũ) ─────────────────────────────────────────────────
  {
    term: "thả thính",
    aliases: ["thính"],
    regexPattern: "\\bth[aả]\\s+th[íi]nh\\b",
    category: "Gen Z VN",
  },
  {
    term: "crush",
    aliases: [],
    regexPattern: "\\bcrush\\b",
    category: "Gen Z VN",
  },
  {
    term: "hóng",
    aliases: [],
    regexPattern: "\\bh[oó]ng\\b",
    category: "Gen Z VN",
  },
  {
    term: "drama",
    aliases: [],
    regexPattern: "\\bdrama\\b",
    category: "Gen Z VN",
  },
  {
    term: "xịn xò",
    aliases: ["xịn"],
    regexPattern: "\\bx[ịi]n\\s*x[oò]?\\b",
    category: "Gen Z VN",
  },
  {
    term: "đỉnh kout",
    aliases: ["đỉnh của chóp", "đỉnh nóc"],
    regexPattern: "\\bđ[ỉi]nh\\s+(kout|của\\s+ch[oó]p|n[oó]c)\\b",
    category: "Gen Z VN",
  },
  {
    term: "rep",
    aliases: ["rep tin"],
    regexPattern: "\\brep(\\s+tin)?\\b",
    category: "Gen Z VN",
  },
  {
    term: "gg",
    aliases: ["good game"],
    regexPattern: "\\bgg\\b",
    category: "Gaming",
  },
  {
    term: "afk",
    aliases: ["away from keyboard"],
    regexPattern: "\\bafk\\b",
    category: "Gaming",
  },

  // ── Gen Z VN 2025 — từ Zalopay ───────────────────────────────────────────
  {
    term: "chưa đủ wow",
    aliases: ["chưa wow"],
    regexPattern: "ch[ưu]a\\s+đ[ủu]\\s+wow",
    category: "Gen Z VN 2025",
  },
  {
    term: "trốn nợ thoải mái",
    aliases: [],
    regexPattern: "tr[ốo]n\\s+n[ợo]\\s+tho[ải]i\\s+m[ái]i",
    category: "Gen Z VN 2025",
  },
  {
    term: "thân chưa mà giỡn",
    aliases: [],
    regexPattern: "th[âa]n\\s+ch[ưu]a\\s+m[àa]\\s+gi[ỡo]n",
    category: "Gen Z VN 2025",
  },
  {
    term: "cộng tươi",
    aliases: [],
    regexPattern: "c[ộo]ng\\s+t[ươu]i",
    category: "Gen Z VN 2025",
  },
  {
    term: "hướng nội hết phần đời còn lại",
    aliases: ["hướng nội hết phần đời"],
    regexPattern: "h[ướu]ng\\s+n[ội]i\\s+h[ết]t\\s+ph[ần]n\\s+đ[ời]i",
    category: "Gen Z VN 2025",
  },
  {
    term: "trùng sinh chắc luôn",
    aliases: ["trùng sinh"],
    regexPattern: "tr[ùu]ng\\s+sinh(\\s+ch[ắa]c\\s+lu[ôo]n)?",
    category: "Gen Z VN 2025",
  },
  {
    term: "vượt mức pickleball",
    aliases: [],
    regexPattern: "v[ượu]t\\s+m[ức]c\\s+pickleball",
    category: "Gen Z VN 2025",
  },
  {
    term: "trí thông minh giản dị",
    aliases: [],
    regexPattern: "tr[í]\\s+th[ôo]ng\\s+minh\\s+gi[ản]n\\s+d[ị]",
    category: "Gen Z VN 2025",
  },
  {
    term: "hệ thống chắc chắn có hệ thống",
    aliases: ["có hệ thống"],
    regexPattern: "ch[ắa]c\\s+ch[ắa]n\\s+c[ó]\\s+h[ệ]\\s+th[ốo]ng",
    category: "Gen Z VN 2025",
  },
  {
    term: "baby three",
    aliases: ["bé ba", "bé 3"],
    regexPattern: "(baby\\s+three|b[é]\\s+(ba|3))",
    category: "Gen Z VN 2025",
  },
  {
    term: "thắng đời 1-0",
    aliases: ["thắng đời"],
    regexPattern: "th[ắa]ng\\s+đ[ời]i\\s+(1[:\\-]0|một\\s+kh[ôo]ng)",
    category: "Gen Z VN 2025",
  },
  {
    term: "các mom",
    aliases: ["các mom ơi"],
    regexPattern: "c[á]c\\s+mom",
    category: "Gen Z VN 2025",
  },
  {
    term: "mùa thu hà nội",
    aliases: [],
    regexPattern: "m[ùu]a\\s+thu\\s+h[àa]\\s+n[ội]i",
    category: "Gen Z VN 2025",
  },
  {
    term: "hơn cả khu tự trị",
    aliases: [],
    regexPattern: "h[ơo]n\\s+c[ả]\\s+khu\\s+t[ự]\\s+tr[ị]",
    category: "Gen Z VN 2025",
  },
  {
    term: "đại đại đi",
    aliases: [],
    regexPattern: "đ[ại]i\\s+đ[ại]i\\s+đi",
    category: "Gen Z VN 2025",
  },
  {
    term: "sản xuất theo lô",
    aliases: [],
    regexPattern: "s[ản]n\\s+xu[ất]t\\s+theo\\s+l[ô]",
    category: "Gen Z VN 2025",
  },
  {
    term: "nhét chữ vào mồm",
    aliases: [],
    regexPattern: "nh[ét]t\\s+ch[ữu]\\s+v[àa]o\\s+m[ồo]m",
    category: "Gen Z VN 2025",
  },
  {
    term: "tòa không chơi tòa không hiểu",
    aliases: ["tòa không hiểu"],
    regexPattern: "t[òo]a\\s+kh[ôo]ng\\s+(ch[ơo]i|hi[ểe]u)",
    category: "Gen Z VN 2025",
  },
  {
    term: "tao chỉ để làm tăng dân số",
    aliases: ["làm tăng dân số"],
    regexPattern: "l[àa]m\\s+t[ăa]ng\\s+d[âa]n\\s+s[ố]",
    category: "Gen Z VN 2025",
  },
  {
    term: "xóa vội đoạn nghị luận 500 chữ",
    aliases: ["đoạn nghị luận 500 chữ"],
    regexPattern: "ngh[ị]\\s+lu[ận]n\\s+500\\s+ch[ữu]",
    category: "Gen Z VN 2025",
  },
  {
    term: "hên lắm mới xui như vậy",
    aliases: [],
    regexPattern: "h[êe]n\\s+l[ắa]m\\s+m[ới]i\\s+xui",
    category: "Gen Z VN 2025",
  },
  {
    term: "dân fb tới",
    aliases: ["dân facebook tới"],
    regexPattern: "d[âa]n\\s+(fb|facebook)\\s+t[ới]i",
    category: "Gen Z VN 2025",
  },
  {
    term: "cái quái đản gì thế",
    aliases: ["quái đản"],
    regexPattern: "c[ái]i\\s+qu[ái]i\\s+đ[ản]n\\s+g[ì]",
    category: "Gen Z VN 2025",
  },
  {
    term: "liêm",
    aliases: ["liêm chính"],
    regexPattern: "\\bli[eê]m(\\s+ch[íi]nh)?\\b",
    category: "Gen Z VN 2025",
  },
];

async function seed() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI không được cấu hình trong .env.local");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI, { tls: true });
  console.log("✅ Connected to MongoDB");

  let seeded = 0;
  let skipped = 0;

  for (const data of SAMPLE_SLANG) {
    try {
      await SlangEntryModel.findOneAndUpdate({ term: data.term }, data, {
        upsert: true,
        new: true,
      });
      console.log(`✅ Seeded: ${data.term}`);
      seeded++;
    } catch (err) {
      console.warn(`⚠️  Skipped: ${data.term} —`, err);
      skipped++;
    }
  }

  console.log(`\n📊 Done: ${seeded} seeded, ${skipped} skipped.`);
  await mongoose.disconnect();
}

seed().catch(console.error);
