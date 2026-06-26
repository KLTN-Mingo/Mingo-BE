// src/services/moderation/data/toxic-blocklist.ts

/**
 * Từ tiếng Việt có dấu — check bằng normalizeKeepDiacritic
 * Giữ dấu để tránh false positive: "các bạn" ≠ "cặc"
 */
export const TOXIC_BLOCKLIST_DIACRITIC: readonly string[] = [
  // ── Tục tĩu — cụm từ ─────────────────────────────────────────────────────
  "địt con mẹ mày",
  "đụ đĩ mẹ mày",
  "cái lồn má mày",
  "con lồn",
  "con cặc",
  "đầu buồi",
  "đéo mẹ",
  "đéo má",
  "vãi lồn",

  // ── Tục tĩu — từ đơn (thiếu trong bản cũ) ────────────────────────────────
  "cặc",
  "buồi",
  "lồn",
  "địt",
  "đụ",
  "đéo",

  // ── Xúc phạm cá nhân ──────────────────────────────────────────────────────
  "đồ ngu",
  "con ngu",
  "thằng ngu",
  "đồ đĩ",
  "con đĩ",
  "thằng đĩ",
  "con mẹ mày",
  "thằng chó",
  "đồ chó", // ← thêm
  "đồ khỉ", // ← thêm
  "thằng khốn", // ← thêm
  "con khốn", // ← thêm
  "đồ khốn", // ← thêm
  "chết tiệt",
  "đồ súc vật",
  "con súc vật",
  "đồ cặn bã", // ← thêm
  "đồ rác rưởi", // ← thêm
  "đồ vô học",
  "thằng vô học",
  "loại mất dạy",
  "con mất dạy",
  "thằng mất dạy",

  // ── Đe dọa ────────────────────────────────────────────────────────────────
  "mày chết", // ← thêm
  "tao giết", // ← thêm
  "cho mày chết", // ← thêm
];

/**
 * Từ tiếng Anh + viết tắt + từ Việt không dấu cố tình né filter
 * Check bằng normalizeStripped (bỏ dấu + leet)
 */
export const TOXIC_BLOCKLIST_NORMALIZED: readonly string[] = [
  // ── Tiếng Anh ─────────────────────────────────────────────────────────────
  "bitch",
  "asshole",
  "cunt",
  "cock",
  "whore",
  "slut",
  "faggot",
  "retard",
  "motherfucker",
  "jackass",
  "dipshit",
  "scumbag",
  "prick",
  "wanker",

  // ── Từ Việt không dấu để né filter ───────────────────────────────────────
  "dit con me may",
  "du di me may",
  "con lon",
  "cai lon ma may",
  "con cac",
  "dau buoi",
  "deo me",
  "deo ma",
  "vai lon",

  // ── Viết tắt tục tĩu phổ biến (← thêm) ──────────────────────────────────
  "dm", // địt mẹ
  "dmm", // địt mẹ mày
  "vcl", // vãi cả lồn
  "clm", // cái lồn mẹ
  "đm", // giữ cả bản có dấu
  "vkl", // variant vcl
];
