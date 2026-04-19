// src/services/moderation/rule-based.service.ts

export interface RuleCheckResult {
  isClearViolation: boolean;
  violationType?: string;
  /** 0–1 mức rủi ro tổng hợp từ rule */
  score: number;
  needsAICheck: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LEN = 12_000;

/**
 * Ngưỡng spam để phân loại là vi phạm rõ ràng.
 * Trước đây đặt 0.85 nhưng max score từ các signal chỉ đạt 0.75
 * → điều kiện không bao giờ thoả mãn (dead code).
 * Giảm xuống 0.70 để khớp với giá trị cao nhất có thể xảy ra.
 */
const SPAM_CLEAR_THRESHOLD = 0.7;

/** Ngưỡng dưới để gửi sang AI review (ambiguous zone) */
const SPAM_AMBIGUOUS_LOW = 0.25;

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Chuẩn hoá văn bản để so khớp blocklist:
 * - lowercase
 * - bỏ dấu (NFD + strip combining marks)
 * - gộp khoảng trắng liên tiếp
 */
function normalizeForBlocklist(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      // THAY ĐỔI Ở ĐÂY:
      // Thay vì xóa sạch, ta thay dấu câu bằng 1 khoảng trắng
      // Regex này bao gồm các dấu câu phổ biến: .,!?:;...
      .replace(/[\d.,/#!$%^&*;:{}=\-_`~()]/g, " ")
      // Sau đó gộp các khoảng trắng thừa lại thành 1
      .replace(/\s+/g, " ")
      .trim()
  );
}

// ---------------------------------------------------------------------------
// Blocklist
// ---------------------------------------------------------------------------

/** 20+ từ/cụm cần lọc (tiếng Việt + tiếng Anh) */
const TOXIC_BLOCKLIST: readonly string[] = [
  "địt",
  "đụ",
  "lồn",
  "cặc",
  "đồ chó",
  "đồ ngu",
  "con ngu",
  "thằng ngu",
  "đồ đĩ",
  "con đĩ",
  "thằng đĩ",
  "con mẹ mày",
  "thằng chó",
  "đồ khốn",
  "chết tiệt",
  "đồ điên",
  "mẹ kiếp",
  "vcl",
  "clm",
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "dick",
  "pussy",
  "whore",
  "slut",
  "faggot",
  "retard",
];

interface BlocklistEntry {
  original: string;
  normalized: string;
  /** Từ đơn (không chứa khoảng trắng) → cần word-boundary match */
  isSingleWord: boolean;
  /** Regex dùng cho từ đơn, lazy-built lần đầu */
  wordRe?: RegExp;
}

/**
 * Pre-build blocklist entries một lần khi module load.
 * Đối với từ đơn, ta build RegExp dạng `(?:^|\s)word(?:\s|$)` để tránh
 * false positive khi từ xuất hiện bên trong một từ khác (vd: "cặc" → "cac"
 * khớp sai trong "cách" → "cach").
 */
const BLOCKLIST_ENTRIES: readonly BlocklistEntry[] = TOXIC_BLOCKLIST.map(
  (phrase) => {
    const normalized = normalizeForBlocklist(phrase);
    // Sử dụng Regex Boundary thay vì includes()
    // Lưu ý: Vì Tiếng Việt có dấu đã bị normalize thành không dấu,
    // chúng ta dùng ranh giới là khoảng trắng hoặc đầu/cuối câu.
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Regex này đảm bảo từ/cụm từ phải đứng độc lập
    const wordRe = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`);

    return {
      original: phrase,
      normalized,
      isSingleWord: !normalized.includes(" "),
      wordRe,
    };
  }
);

/**
 * Kiểm tra xem `normalizedText` có chứa `entry` hay không.
 *
 * - Cụm từ nhiều chữ (multi-word): substring match đã đủ vì dấu cách tự
 *   đóng vai trò word-boundary.
 * - Từ đơn: dùng regex có word-boundary (\s hoặc đầu/cuối chuỗi) để tránh
 *   match bên trong một từ khác dài hơn.
 */
function blocklistMatches(
  normalizedText: string,
  entry: BlocklistEntry
): boolean {
  // Luôn dùng wordRe để đảm bảo "con ngu" không dính "con người"
  // và "cac" không dính "cach"
  return entry.wordRe!.test(normalizedText);
}

// ---------------------------------------------------------------------------
// Hate-speech patterns
// ---------------------------------------------------------------------------

/** Mẫu gợi ý nội dung thù hận / miệt thị (tiếng Việt) */
const HATE_PATTERNS: readonly RegExp[] = [
  /\b(?:đồ\s+chó|đồ\s+lợn|đồ\s+khỉ|thằng\s+hèn|con\s+hèn)\b/gi,
  /\b(?:mày\s+chết|tao\s+giết|đập\s+chết|chết\s+đi)\b/gi,
  /\b(?:đồ\s+đĩ|con\s+đĩ|đồ\s+cặn\s+bã)\b/gi,
  /\b(?:thằng\s+ngu|con\s+ngu|đồ\s+ngu\s+dốt)\b/gi,
];

// ---------------------------------------------------------------------------
// Spam signals
// ---------------------------------------------------------------------------

/** Không dùng flag /g để tránh lỗi lastIndex khi tái sử dụng .test() */
const REPEAT_CHAR_RE = /(.)\1{8,}/;

/** Regex link — tạo mới mỗi lần gọi để tránh lastIndex của /g */
function matchLinks(text: string): RegExpMatchArray | null {
  return text.match(/https?:\/\/[^\s]+/gi);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyOk(): RuleCheckResult {
  return {
    isClearViolation: false,
    score: 0,
    needsAICheck: false,
    reason: "empty",
  };
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export const RuleBasedService = {
  checkContent(text: string): RuleCheckResult {
    try {
      if (text === undefined || text === null) {
        return emptyOk();
      }

      const raw = String(text);

      if (raw.trim().length === 0) {
        return emptyOk();
      }

      if (raw.length < 2) {
        return {
          isClearViolation: true,
          violationType: "too_short",
          score: 1,
          needsAICheck: false,
          reason: "Nội dung quá ngắn (< 2 ký tự)",
        };
      }

      const slice = raw.length > MAX_LEN ? raw.slice(0, MAX_LEN) : raw;
      const norm = normalizeForBlocklist(slice);

      // ── 1. Profanity blocklist ─────────────────────────────────────────────
      for (const entry of BLOCKLIST_ENTRIES) {
        if (entry.normalized.length > 0 && blocklistMatches(norm, entry)) {
          return {
            isClearViolation: true,
            violationType: "profanity",
            score: 0.95,
            needsAICheck: false,
            reason: `Trùng từ khóa: ${entry.original.slice(0, 20)}`,
          };
        }
      }

      // ── 2. Hate-speech patterns ────────────────────────────────────────────
      for (const pattern of HATE_PATTERNS) {
        // Clone để tránh dùng chung lastIndex khi flag /g
        const reCopy = new RegExp(pattern.source, pattern.flags);
        if (reCopy.test(slice)) {
          return {
            isClearViolation: true,
            violationType: "hate_speech",
            score: 0.92,
            needsAICheck: false,
            reason: "Khớp mẫu nội dung thù hận (regex)",
          };
        }
      }

      // ── 3. Spam signals ────────────────────────────────────────────────────
      let spamScore = 0;
      const spamReasons: string[] = [];

      // 3a. Ký tự lặp 8+ lần liên tiếp
      // if (REPEAT_CHAR_RE.test(slice)) {
      //   spamScore = Math.max(spamScore, 0.55);
      //   spamReasons.push("ky_tu_lap_8+");
      // }

      // 3b. Nhiều link trong cùng một bài
      const links = matchLinks(slice);
      if (links && links.length >= 2) {
        spamScore = Math.max(spamScore, 0.5);
        spamReasons.push("nhieu_link");
      }

      // 3c. Toàn chữ hoa (ALLCAPS) trên đoạn văn dài
      // const lettersOnly = slice.replace(/[^a-zA-Z]/g, "");
      // if (lettersOnly.length > 40) {
      //   const upperCount = lettersOnly.replace(/[^A-Z]/g, "").length;
      //   if (upperCount / lettersOnly.length > 0.85) {
      //     spamScore = Math.max(spamScore, 0.45);
      //     spamReasons.push("allcaps_dai");
      //   }
      // }

      // 3d. Kết hợp nhiều signal → score cộng dồn (có giới hạn)
      const signalCount = spamReasons.length;
      if (signalCount >= 2) {
        spamScore = Math.min(spamScore + 0.2 * (signalCount - 1), 0.9);
      }

      if (spamScore >= SPAM_CLEAR_THRESHOLD) {
        return {
          isClearViolation: true,
          violationType: "spam",
          score: spamScore,
          needsAICheck: false,
          reason: spamReasons.join(","),
        };
      }

      const ambiguous =
        spamScore >= SPAM_AMBIGUOUS_LOW && spamScore < SPAM_CLEAR_THRESHOLD;

      return {
        isClearViolation: false,
        violationType: spamScore > 0 ? "spam_soft" : undefined,
        score: spamScore,
        needsAICheck: ambiguous,
        reason: spamReasons.length > 0 ? spamReasons.join(",") : undefined,
      };
    } catch {
      return {
        isClearViolation: false,
        score: 0,
        needsAICheck: true,
        reason: "rule_internal_fallback",
      };
    }
  },
};
