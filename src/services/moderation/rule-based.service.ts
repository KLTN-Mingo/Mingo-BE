import {
  TOXIC_BLOCKLIST_DIACRITIC,
  TOXIC_BLOCKLIST_NORMALIZED,
} from "./data/toxic-blocklist";
import { HATE_PATTERNS } from "./data/hate-patterns";

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
// Hạ từ 0.7 -> 0.55: cho phép 1 signal spam đủ mạnh tự quyết luôn, không
// buộc phải có 2 signal cộng dồn mới chặn được. Lý do: spam là pattern máy
// móc (lặp ký tự/cụm từ, nhiều link, allcaps), rule-based nên tự tin quyết
// định phần lớn trường hợp, hạn chế việc phải đẩy qua AI mới chặn được spam
// rõ ràng (qua thực nghiệm trên test set, threshold 0.7 khiến nhiều mẫu spam
// rõ ràng chỉ có 1 signal bị rơi vào vùng "ambiguous" thay vì bị chặn ngay).
const SPAM_CLEAR_THRESHOLD = 0.55;
const SPAM_AMBIGUOUS_LOW = 0.25;

// ---------------------------------------------------------------------------
// Leet map
// ---------------------------------------------------------------------------

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "@": "a",
  $: "s",
  "5": "s",
};

function normalizeLeet(text: string): string {
  return text
    .split("")
    .map((c) => LEET_MAP[c] ?? c)
    .join("");
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeKeepDiacritic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/(.)\1{2,}/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStripped(text: string): string {
  return normalizeLeet(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/(.)\1{2,}/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Blocklist entries
// ---------------------------------------------------------------------------

interface BlocklistEntry {
  original: string;
  normalized: string;
  wordRe: RegExp;
}

function buildEntries(
  list: readonly string[],
  normFn: (s: string) => string
): readonly BlocklistEntry[] {
  return list.map((phrase) => {
    const normalized = normFn(phrase);
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return {
      original: phrase,
      normalized,
      wordRe: new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`),
    };
  });
}

const ENTRIES_DIACRITIC = buildEntries(
  TOXIC_BLOCKLIST_DIACRITIC,
  normalizeKeepDiacritic
);

const ENTRIES_NORMALIZED = buildEntries(
  TOXIC_BLOCKLIST_NORMALIZED,
  normalizeStripped
);

// ---------------------------------------------------------------------------
// Match helper
// ---------------------------------------------------------------------------

function findMatch(
  text: string,
  entries: readonly BlocklistEntry[]
): BlocklistEntry | null {
  for (const entry of entries) {
    if (entry.normalized.length > 0 && entry.wordRe.test(text)) {
      return entry;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Spam signals
// ---------------------------------------------------------------------------

const REPEAT_CHAR_RE = /(.)\1{5,}/;

function matchLinks(text: string): RegExpMatchArray | null {
  return text.match(/https?:\/\/[^\s]+/gi);
}

/**
 * Phát hiện lặp CỤM TỪ liên tiếp (vd: "MUA NGAY MUA NGAY MUA NGAY").
 * Khác với REPEAT_CHAR_RE (chỉ bắt lặp 1 ký tự), hàm này bắt cụm 2 từ
 * xuất hiện lại ngay sau đó — pattern rất phổ biến trong spam quảng cáo
 * tiếng Việt mà REPEAT_CHAR_RE không bắt được.
 */
function hasRepeatedPhrase(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < 4) return false;
  for (let i = 0; i + 3 < words.length; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`.toLowerCase();
    const nextPhrase = `${words[i + 2]} ${words[i + 3]}`.toLowerCase();
    if (phrase === nextPhrase) return true;
  }
  return false;
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

      const slice = raw.length > MAX_LEN ? raw.slice(0, MAX_LEN) : raw;

      // ── 1a. Profanity — check có dấu (DIACRITIC) ────────────────────────
      const norm1 = normalizeKeepDiacritic(slice);
      const match1 = findMatch(norm1, ENTRIES_DIACRITIC);
      if (match1) {
        return {
          isClearViolation: true,
          violationType: "profanity",
          score: 0.95,
          needsAICheck: false,
          reason: `Trùng từ khóa: ${match1.original.slice(0, 20)}`,
        };
      }

      // ── 1b. Profanity — check bỏ dấu (NORMALIZED) ───────────────────────
      const norm2 = normalizeStripped(slice);
      const match2 = findMatch(norm2, ENTRIES_NORMALIZED);
      if (match2) {
        return {
          isClearViolation: true,
          violationType: "profanity",
          score: 0.95,
          needsAICheck: false,
          reason: `Trùng từ khóa: ${match2.original.slice(0, 20)}`,
        };
      }

      // ── 2. Hate-speech patterns ──────────────────────────────────────────
      for (const pattern of HATE_PATTERNS) {
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

      // ── 3. Spam signals ──────────────────────────────────────────────────
      let spamScore = 0;
      const spamReasons: string[] = [];

      if (REPEAT_CHAR_RE.test(slice)) {
        spamScore = Math.max(spamScore, 0.55);
        spamReasons.push("ky_tu_lap_6+");
      }

      if (hasRepeatedPhrase(slice)) {
        spamScore = Math.max(spamScore, 0.5);
        spamReasons.push("lap_cum_tu");
      }

      const links = matchLinks(slice);
      if (links && links.length >= 2) {
        spamScore = Math.max(spamScore, 0.5);
        spamReasons.push("nhieu_link");
      }

      // Đếm chữ cái theo Unicode (\p{L}) để không làm mất/méo chữ Việt có dấu
      // (bản cũ dùng slice.replace(/[^a-zA-Z]/g,"") làm mất hẳn các ký tự có dấu,
      // khiến length và tỷ lệ uppercase bị tính sai trên văn bản tiếng Việt viết hoa)
      const letterChars = slice.match(/\p{L}/gu) ?? [];
      if (letterChars.length > 40) {
        const upperCount = letterChars.filter(
          (ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase()
        ).length;
        if (upperCount / letterChars.length > 0.85) {
          spamScore = Math.max(spamScore, 0.45);
          spamReasons.push("allcaps_dai");
        }
      }

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
