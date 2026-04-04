"use strict";
// src/services/culture-translation.service.ts
/** Giải thích slang / meme / văn hóa mạng — gọi Gemini khi có GEMINI_API_KEY */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cultureTranslationService = void 0;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
exports.cultureTranslationService = {
    async explainInContext(text, context) {
        const key = process.env.GEMINI_API_KEY;
        if (!key?.trim()) {
            return {
                term: text.slice(0, 80),
                explanation: "Chưa cấu hình GEMINI_API_KEY. Thêm key vào .env để bật giải thích LLM.",
                language: "vi",
            };
        }
        const prompt = `Bạn là trợ lý văn hóa mạng (Việt Nam & quốc tế). Người dùng chọn/hỏi cụm: "${text}"
${context ? `Ngữ cảnh đoạn chứa cụm đó: """${context}"""` : ""}

Trả về JSON thuần (không markdown) với các key:
- "term": cụm được giải thích (ngắn)
- "explanation": giải thích dễ hiểu cho người không quen slang (2-5 câu tiếng Việt)
- "origin": nguồn gốc / meme / nền tảng nếu biết, không chắc thì ""
- "tone": hài hước / mỉa mai / trung tính / toxic hint / ""
- "language": "vi"`;
        const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 1024,
                },
            }),
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 200)}`);
        }
        const data = (await res.json());
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
        let parsed = {};
        try {
            const m = raw.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(m ? m[0] : raw);
        }
        catch {
            parsed = { explanation: raw.trim() };
        }
        return {
            term: typeof parsed.term === "string" ? parsed.term : text.slice(0, 80),
            explanation: typeof parsed.explanation === "string"
                ? parsed.explanation
                : "Không phân tích được.",
            origin: typeof parsed.origin === "string" ? parsed.origin : undefined,
            tone: typeof parsed.tone === "string" ? parsed.tone : undefined,
            language: typeof parsed.language === "string" ? parsed.language : "vi",
        };
    },
};
