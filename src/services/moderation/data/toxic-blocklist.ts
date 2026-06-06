// src/services/moderation/data/toxic-blocklist.ts

/**
 * Từ tiếng Việt có dấu — check bằng normalizeKeepDiacritic
 * Giữ dấu để tránh false positive: "các bạn" ≠ "cặc"
 */
export const TOXIC_BLOCKLIST_DIACRITIC: readonly string[] = [
  // ── Tục tĩu ───────────────────────────────────────────────────────────────
  "địt con mẹ mày",
  "đụ đĩ mẹ mày",
  "cái lồn má mày",
  "con lồn",
  "con cặc",
  "đầu buồi",
  "đéo mẹ",
  "đéo má",
  "vãi lồn",

  // ── Xúc phạm cá nhân ──────────────────────────────────────────────────────
  "đồ ngu",
  "con ngu",
  "thằng ngu",
  "đồ đĩ",
  "con đĩ",
  "thằng đĩ",
  "con mẹ mày",
  "thằng chó",
  "chết tiệt",
  "đồ súc vật",
  "con súc vật",
  "đồ vô học",
  "thằng vô học",
  "loại mất dạy",
  "con mất dạy",
  "thằng mất dạy",
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

  // ── Từ Việt thường bị viết không dấu để né filter ─────────────────────────
  "dit con me may",
  "du di me may",
  "con lon",
  "cai lon ma may",
  "con cac",
  "dau buoi",
  "deo me",
  "deo ma",
  "vai lon",
];
