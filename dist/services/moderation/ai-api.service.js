"use strict";
// src/services/moderation/ai-api.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIApiService = void 0;
// ✅ Dùng model bạn có quota
// Sửa thành gemini-3-flash-preview theo đúng ảnh bạn gửi
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function clamp01(n) {
    if (!Number.isFinite(n))
        return 0;
    return Math.min(1, Math.max(0, n));
}
function stripCodeFences(raw) {
    let s = raw.trim();
    if (s.startsWith("```")) {
        s = s.replace(/^```(?:json)?\s*/i, "");
        s = s.replace(/\s*```\s*$/s, "");
    }
    return s.trim();
}
function parseAiJson(text) {
    try {
        const cleaned = stripCodeFences(text);
        // lấy JSON trong chuỗi nếu có text dư
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        const payload = jsonMatch ? jsonMatch[0] : cleaned;
        const parsed = JSON.parse(payload);
        return {
            toxic: Number(parsed.toxic),
            hate_speech: Number(parsed.hate_speech),
            spam: Number(parsed.spam),
            reason: typeof parsed.reason === "string"
                ? parsed.reason
                : String(parsed.reason ?? ""),
        };
    }
    catch {
        return null;
    }
}
// Node 18+ có sẵn fetch
function getFetch() {
    if (typeof globalThis.fetch === "function") {
        return globalThis.fetch.bind(globalThis);
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("node-fetch");
    }
    catch {
        throw new Error("Fetch not available. Use Node 18+ or install node-fetch.");
    }
}
// ────────────────────────────────────────────────────────────
// Main Service
// ────────────────────────────────────────────────────────────
exports.AIApiService = {
    async analyzeContent(text) {
        try {
            console.log("API KEY:", process.env.GEMINI_API_KEY);
            console.log("🤖 [AI] analyzeContent called");
            console.log("📄 Content:", text);
            const apiKey = process.env.GEMINI_API_KEY;
            console.log("🔑 API KEY exists:", !!apiKey);
            // ❌ Không có key → fallback
            if (!apiKey) {
                return {
                    toxic: 0.1,
                    hateSpeech: 0,
                    spam: 0.1,
                    reason: "no_api_key",
                };
            }
            // ✅ limit text (tránh token vượt quota)
            const safe = String(text).slice(0, 5000).replace(/```/g, "`\u200b``");
            const prompt = `
You are a content safety classifier for a social network.

Return ONLY valid JSON:
{"toxic": number 0-1, "hate_speech": number 0-1, "spam": number 0-1, "reason": string}

If content is safe, return low scores and reason = "clean".

Content:
${safe}
`;
            console.log("📤 [AI] Sending request...");
            const fetchImpl = getFetch();
            const res = await fetchImpl(`${API_URL}?key=${apiKey}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }],
                        },
                    ],
                }),
            });
            const data = await res.json();
            console.log("📥 [AI] Raw response:", JSON.stringify(data));
            // ❌ lỗi HTTP (quota, model, ...)
            if (!res.ok) {
                console.warn("⚠️ [AI] HTTP error:", res.status);
                return {
                    toxic: 0.2,
                    hateSpeech: 0,
                    spam: 0.2,
                    reason: "fallback_http_error",
                };
            }
            const output = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            const parsed = parseAiJson(output);
            // ❌ parse fail
            if (!parsed) {
                console.warn("⚠️ [AI] Parse failed");
                return {
                    toxic: 0.15,
                    hateSpeech: 0,
                    spam: 0.1,
                    reason: "fallback_parse_error",
                };
            }
            const result = {
                toxic: clamp01(parsed.toxic ?? 0),
                hateSpeech: clamp01(parsed.hate_speech ?? 0),
                spam: clamp01(parsed.spam ?? 0),
                reason: parsed.reason || "ok",
            };
            console.log("✅ [AI RESULT]:", result);
            return result;
        }
        catch (error) {
            console.error("💥 [AI ERROR]:", error);
            // ❌ exception → fallback
            return {
                toxic: 0.2,
                hateSpeech: 0,
                spam: 0.2,
                reason: "fallback_exception",
            };
        }
    },
};
