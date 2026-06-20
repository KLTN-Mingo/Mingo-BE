// src/scripts/seed-slang-dictionary.ts
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mongoose from "mongoose";
import { SlangEntryModel } from "../models/culture-translation.model";
import {
  buildVietnameseRegex,
  validateRegex,
  selfTest,
} from "../utils/vn-regex-builder";

/**
 * Helper: build entry với regex tự động.
 * - Nếu truyền regexPattern thủ công → dùng nguyên (cho từ Latin/Gaming không cần xử lý dấu)
 * - Nếu không truyền → tự build từ term (cho tiếng Việt có dấu)
 */
function entry(data: {
  term: string;
  aliases?: string[];
  regexPattern?: string;
  category: string;
}) {
  const pattern = data.regexPattern ?? buildVietnameseRegex(data.term);

  const { valid, error } = validateRegex(pattern);
  if (!valid) {
    console.error(`❌ Regex không hợp lệ cho "${data.term}": ${error}`);
    process.exit(1);
  }

  const passes = selfTest(data.term, pattern);
  if (!passes) {
    console.warn(
      `⚠️  Regex không self-match cho "${data.term}" — pattern: ${pattern}`
    );
  }

  return { ...data, regexPattern: pattern };
}

const SAMPLE_SLANG = [
  // ── Gaming ────────────────────────────────────────────────────────────────
  // Từ Latin/tiếng Anh: giữ \b vì hoạt động đúng với ASCII
  entry({
    term: "noob",
    aliases: ["newbie", "nub"],
    regexPattern: "\\b(noob|newbie|nub)s?\\b",
    category: "Gaming",
  }),
  entry({
    term: "flex",
    aliases: [],
    regexPattern: "\\bflex(ing)?\\b",
    category: "Gen Z",
  }),
  entry({
    term: "ib4l",
    aliases: ["ib4ll"],
    regexPattern: "\\bib4l{1,}\\b",
    category: "Gen Z",
  }),
  entry({
    term: "chill",
    aliases: [],
    regexPattern: "\\bchill(ing|ed)?\\b",
    category: "Chung",
  }),
  entry({
    term: "gank",
    aliases: [],
    regexPattern: "\\bgank(ed|ing)?\\b",
    category: "Gaming",
  }),
  entry({
    term: "toxic",
    aliases: [],
    regexPattern: "\\btoxic\\b",
    category: "Gaming",
  }),
  entry({
    term: "ghosting",
    aliases: ["ghost"],
    regexPattern: "\\bghost(ing|ed)?\\b",
    category: "Gen Z",
  }),
  entry({
    term: "simp",
    aliases: ["simping"],
    regexPattern: "\\bsimp(ing|ed|s)?\\b",
    category: "Gen Z",
  }),
  entry({
    term: "fomo",
    aliases: [],
    regexPattern: "\\bfomo\\b",
    category: "Gen Z",
  }),
  entry({
    term: "sus",
    aliases: [],
    regexPattern: "\\bsus\\b",
    category: "Gaming",
  }),

  // ── Gen Z Tiếng Anh ───────────────────────────────────────────────────────
  entry({
    term: "slay",
    aliases: ["slaying"],
    regexPattern: "\\bslay(ing)?\\b",
    category: "Gen Z",
  }),
  entry({
    term: "vibe",
    aliases: ["vibing", "vibes"],
    regexPattern: "\\bvibe(s|ing)?\\b",
    category: "Gen Z",
  }),
  entry({
    term: "no cap",
    aliases: ["nocap"],
    regexPattern: "\\bno\\s?cap\\b",
    category: "Gen Z",
  }),
  entry({
    term: "lowkey",
    aliases: ["low key"],
    regexPattern: "\\blow[\\s-]?key\\b",
    category: "Gen Z",
  }),
  entry({
    term: "highkey",
    aliases: ["high key"],
    regexPattern: "\\bhigh[\\s-]?key\\b",
    category: "Gen Z",
  }),
  entry({
    term: "bussin",
    aliases: ["bussing"],
    regexPattern: "\\bbussin(g)?\\b",
    category: "Gen Z",
  }),
  entry({
    term: "based",
    aliases: [],
    regexPattern: "\\bbased\\b",
    category: "Gen Z",
  }),
  entry({
    term: "cringe",
    aliases: ["cringy"],
    regexPattern: "\\bcringe?(y)?\\b",
    category: "Gen Z",
  }),
  entry({
    term: "mid",
    aliases: [],
    regexPattern: "\\bmid\\b",
    category: "Gen Z",
  }),
  entry({
    term: "rizz",
    aliases: ["rizzed"],
    regexPattern: "\\brizz(ed)?\\b",
    category: "Gen Z",
  }),
  entry({
    term: "ratio",
    aliases: ["ratioed"],
    regexPattern: "\\bratio(ed)?\\b",
    category: "Gen Z",
  }),
  entry({
    term: "ngl",
    aliases: ["not gonna lie"],
    regexPattern: "\\bngl\\b",
    category: "Gen Z",
  }),
  entry({
    term: "iykyk",
    aliases: ["if you know you know"],
    regexPattern: "\\biykyk\\b",
    category: "Gen Z",
  }),
  entry({
    term: "tbh",
    aliases: ["to be honest"],
    regexPattern: "\\btbh\\b",
    category: "Gen Z",
  }),
  entry({
    term: "periodt",
    aliases: ["period"],
    regexPattern: "\\bperiod[t]?\\b",
    category: "Gen Z",
  }),
  entry({
    term: "main character",
    aliases: ["main character energy"],
    regexPattern: "\\bmain\\s+character(\\s+energy)?\\b",
    category: "Gen Z",
  }),
  entry({
    term: "glow up",
    aliases: ["glowup"],
    regexPattern: "\\bglow[\\s-]?up\\b",
    category: "Gen Z",
  }),
  entry({
    term: "gg",
    aliases: ["good game"],
    regexPattern: "\\bgg\\b",
    category: "Gaming",
  }),
  entry({
    term: "afk",
    aliases: ["away from keyboard"],
    regexPattern: "\\bafk\\b",
    category: "Gaming",
  }),

  // ── Gen Z Tiếng Việt — dùng buildVietnameseRegex (không truyền regexPattern) ──
  entry({ term: "thả thính", aliases: ["thính"], category: "Gen Z VN" }),
  entry({ term: "hóng", aliases: [], category: "Gen Z VN" }),
  entry({ term: "xịn xò", aliases: ["xịn"], category: "Gen Z VN" }),
  entry({
    term: "đỉnh kout",
    aliases: ["đỉnh của chóp", "đỉnh nóc"],
    category: "Gen Z VN",
  }),
  entry({
    term: "rep",
    aliases: ["rep tin"],
    regexPattern: "\\brep(\\s+tin)?\\b",
    category: "Gen Z VN",
  }),
  entry({
    term: "crush",
    aliases: [],
    regexPattern: "\\bcrush\\b",
    category: "Gen Z VN",
  }),
  entry({
    term: "drama",
    aliases: [],
    regexPattern: "\\bdrama\\b",
    category: "Gen Z VN",
  }),

  // ── Gen Z VN 2025 — tất cả dùng buildVietnameseRegex ─────────────────────
  entry({
    term: "chưa đủ wow",
    aliases: ["chưa wow"],
    category: "Gen Z VN 2025",
  }),
  entry({ term: "trốn nợ thoải mái", aliases: [], category: "Gen Z VN 2025" }),
  entry({ term: "thân chưa mà giỡn", aliases: [], category: "Gen Z VN 2025" }),
  entry({ term: "cộng tươi", aliases: [], category: "Gen Z VN 2025" }),
  entry({
    term: "hướng nội hết phần đời còn lại",
    aliases: ["hướng nội hết phần đời"],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "trùng sinh chắc luôn",
    aliases: ["trùng sinh"],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "vượt mức pickleball",
    aliases: [],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "trí thông minh giản dị",
    aliases: [],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "hệ thống chắc chắn có hệ thống",
    aliases: ["có hệ thống"],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "baby three",
    aliases: ["bé ba", "bé 3"],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "thắng đời 1-0",
    aliases: ["thắng đời"],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "các mom",
    aliases: ["các mom ơi"],
    category: "Gen Z VN 2025",
  }),
  entry({ term: "mùa thu hà nội", aliases: [], category: "Gen Z VN 2025" }),
  entry({ term: "hơn cả khu tự trị", aliases: [], category: "Gen Z VN 2025" }),
  entry({ term: "đại đại đi", aliases: [], category: "Gen Z VN 2025" }),
  entry({ term: "sản xuất theo lô", aliases: [], category: "Gen Z VN 2025" }),
  entry({ term: "nhét chữ vào mồm", aliases: [], category: "Gen Z VN 2025" }),
  entry({
    term: "tòa không chơi tòa không hiểu",
    aliases: ["tòa không hiểu"],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "tao chỉ để làm tăng dân số",
    aliases: ["làm tăng dân số"],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "xóa vội đoạn nghị luận 500 chữ",
    aliases: ["đoạn nghị luận 500 chữ"],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "hên lắm mới xui như vậy",
    aliases: [],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "dân fb tới",
    aliases: ["dân facebook tới"],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "cái quái đản gì thế",
    aliases: ["quái đản"],
    category: "Gen Z VN 2025",
  }),
  entry({ term: "liêm", aliases: ["liêm chính"], category: "Gen Z VN 2025" }),
  entry({
    term: "nhiệm vụ hệ thống ngày càng khó",
    aliases: ["nvht ngày càng khó", "nhiệm vụ hệ thống"],
    category: "Gen Z VN 2025",
  }),
  entry({
    term: "cổ điển, tôn trọng",
    aliases: ["cổ điển tôn trọng", "rất cổ điển rất tôn trọng"],
    category: "Gen Z VN 2025",
  }),
  entry({ term: "ô dề", aliases: [], category: "Gen Z VN 2025" }),
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
