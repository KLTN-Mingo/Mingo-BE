"use strict";
// src/services/moderation/rule-based.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleBasedService = void 0;
const MAX_LEN = 12000;
function normalizeForBlocklist(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}
/** 20+ từ/cụm cần lọc (tiếng Việt + tiếng Anh) — mở rộng theo chính sách sản phẩm */
const TOXIC_BLOCKLIST = [
    "địt",
    "đụ",
    "lồn",
    "cặc",
    "đồ chó",
    "đồ ngu",
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
/** Cùng quy tắc normalize với `norm` của input — so khớp substring an toàn với văn bản đã bỏ dấu */
const TOXIC_BLOCKLIST_NORMALIZED = TOXIC_BLOCKLIST.map((phrase) => normalizeForBlocklist(phrase));
/** Mẫu gợi ý nội dung thù hận / miệt thị (tiếng Việt) — bổ sung theo nhu cầu */
const HATE_PATTERNS = [
    /\b(?:đồ\s+chó|đồ\s+lợn|đồ\s+khỉ|thằng\s+hèn|con\s+hèn)\b/gi,
    /\b(?:mày\s+chết|tao\s+giết|đập\s+chết|chết\s+đi)\b/gi,
    /\b(?:đồ\s+đĩ|con\s+đĩ|đồ\s+cặn\s+bã)\b/gi,
    /\b(?:thằng\s+ngu|con\s+ngu|đồ\s+ngu\s+dốt)\b/gi,
];
const SPAM_LINK_RE = /https?:\/\/[^\s]+/gi;
/** Không dùng flag /g để tránh lastIndex khi .test() */
const REPEAT_CHAR_RE = /(.)\1{3,}/;
function emptyOk() {
    return {
        isClearViolation: false,
        score: 0,
        needsAICheck: false,
        reason: "empty",
    };
}
exports.RuleBasedService = {
    checkContent(text) {
        try {
            if (text === undefined || text === null) {
                return emptyOk();
            }
            const raw = String(text);
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
            for (let i = 0; i < TOXIC_BLOCKLIST_NORMALIZED.length; i++) {
                const needle = TOXIC_BLOCKLIST_NORMALIZED[i];
                if (needle.length > 0 && norm.includes(needle)) {
                    return {
                        isClearViolation: true,
                        violationType: "profanity",
                        score: 0.95,
                        needsAICheck: false,
                        reason: `Trùng từ khóa: ${TOXIC_BLOCKLIST[i].slice(0, 20)}`,
                    };
                }
            }
            for (const re of HATE_PATTERNS) {
                const reCopy = new RegExp(re.source, re.flags);
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
            let spamScore = 0;
            const spamReasons = [];
            if (REPEAT_CHAR_RE.test(slice)) {
                spamScore = Math.max(spamScore, 0.75);
                spamReasons.push("ký_tự_lặp_4+");
            }
            SPAM_LINK_RE.lastIndex = 0;
            const links = slice.match(SPAM_LINK_RE);
            if (links && links.length >= 2) {
                spamScore = Math.max(spamScore, 0.7);
                spamReasons.push("nhieu_link");
            }
            const lettersOnly = slice.replace(/[^a-zA-Z]/g, "");
            if (lettersOnly.length > 40) {
                const upper = lettersOnly.replace(/[^A-Z]/g, "").length;
                if (upper / lettersOnly.length > 0.85) {
                    spamScore = Math.max(spamScore, 0.65);
                    spamReasons.push("allcaps_dai");
                }
            }
            if (spamScore >= 0.85) {
                return {
                    isClearViolation: true,
                    violationType: "spam",
                    score: spamScore,
                    needsAICheck: false,
                    reason: spamReasons.join(","),
                };
            }
            const score = spamScore;
            const ambiguous = score >= 0.25 && score < 0.85;
            return {
                isClearViolation: false,
                violationType: spamScore > 0 ? "spam_soft" : undefined,
                score,
                needsAICheck: ambiguous,
                reason: spamReasons.length > 0 ? spamReasons.join(",") : undefined,
            };
        }
        catch {
            return {
                isClearViolation: false,
                score: 0,
                needsAICheck: true,
                reason: "rule_internal_fallback",
            };
        }
    },
};
