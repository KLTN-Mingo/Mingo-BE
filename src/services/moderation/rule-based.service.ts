// src/services/moderation/rule-based.service.ts
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
const SPAM_CLEAR_THRESHOLD = 0.7;
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

/**
 * Lần 1: Giữ dấu tiếng Việt — dùng cho TOXIC_BLOCKLIST_DIACRITIC
 * Mục đích: tránh false positive "các bạn" → "cac ban" khớp "cặc"
 */
function normalizeKeepDiacritic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // bỏ ký tự đặc biệt, giữ chữ có dấu
    .replace(/(.)\1{2,}/gu, "$1") // collapse ký tự lặp
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lần 2: Bỏ dấu hoàn toàn + leet — dùng cho TOXIC_BLOCKLIST_NORMALIZED
 * Mục đích: bắt người cố tình né filter bằng cách viết không dấu / leet
 */
function normalizeStripped(text: string): string {
  return normalizeLeet(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // bỏ dấu tiếng Việt
    .replace(/[^\p{L}\p{N}\s]/gu, "") // bỏ ký tự đặc biệt, emoji
    .replace(/(.)\1{2,}/gu, "$1") // collapse ký tự lặp
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

/** Check có dấu — tránh false positive với từ thông thường */
const ENTRIES_DIACRITIC = buildEntries(
  TOXIC_BLOCKLIST_DIACRITIC,
  normalizeKeepDiacritic
);

/** Check bỏ dấu — bắt người né filter */
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

      // if (raw.length < 2) {
      //   return {
      //     isClearViolation: true,
      //     violationType: "too_short",
      //     score: 1,
      //     needsAICheck: false,
      //     reason: "Nội dung quá ngắn (< 2 ký tự)",
      //   };
      // }

      const slice = raw.length > MAX_LEN ? raw.slice(0, MAX_LEN) : raw;

      // ── 1a. Profanity — check có dấu (DIACRITIC) ────────────────────────
      // Ưu tiên check trước để tránh false positive
      // VD: "các bạn" không bị nhầm thành "cặc"
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
      // Bắt các trường hợp né filter: "c4c", "đ1t", "c.ặ.c", "lồnnnn"
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

      // 3a. Ký tự lặp 6+ lần liên tiếp
      if (REPEAT_CHAR_RE.test(slice)) {
        spamScore = Math.max(spamScore, 0.55);
        spamReasons.push("ky_tu_lap_6+");
      }

      // 3b. Nhiều link trong cùng một bài
      const links = matchLinks(slice);
      if (links && links.length >= 2) {
        spamScore = Math.max(spamScore, 0.5);
        spamReasons.push("nhieu_link");
      }

      // 3c. Toàn chữ hoa (ALLCAPS) trên đoạn văn dài
      const lettersOnly = slice.replace(/[^a-zA-Z]/g, "");
      if (lettersOnly.length > 40) {
        const upperCount = lettersOnly.replace(/[^A-Z]/g, "").length;
        if (upperCount / lettersOnly.length > 0.85) {
          spamScore = Math.max(spamScore, 0.45);
          spamReasons.push("allcaps_dai");
        }
      }

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
