// src/services/moderation/ai-api.service.ts

export interface AIScoreResult {
  toxic: number;
  hateSpeech: number;
  spam: number;
  reason: string;
}

// ✅ Dùng model bạn có quota
// Sửa thành gemini-3-flash-preview theo đúng ảnh bạn gửi
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function stripCodeFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "");
    s = s.replace(/\s*```\s*$/s, "");
  }
  return s.trim();
}

function parseAiJson(text: string): Partial<{
  toxic: number;
  hate_speech: number;
  spam: number;
  reason: string;
}> | null {
  try {
    const cleaned = stripCodeFences(text);

    // lấy JSON trong chuỗi nếu có text dư
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const payload = jsonMatch ? jsonMatch[0] : cleaned;

    const parsed = JSON.parse(payload) as Record<string, unknown>;

    return {
      toxic: Number(parsed.toxic),
      hate_speech: Number(parsed.hate_speech),
      spam: Number(parsed.spam),
      reason:
        typeof parsed.reason === "string"
          ? parsed.reason
          : String(parsed.reason ?? ""),
    };
  } catch {
    return null;
  }
}

// Node 18+ có sẵn fetch
function getFetch(): typeof fetch {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("node-fetch");
  } catch {
    throw new Error("Fetch not available. Use Node 18+ or install node-fetch.");
  }
}

// ────────────────────────────────────────────────────────────
// Main Service
// ────────────────────────────────────────────────────────────
export const AIApiService = {
  async analyzeContent(text: string): Promise<AIScoreResult> {
    try {
      console.log("🤖 [AI] analyzeContent called");
      console.log("📄 Content:", text);

      const apiKey = process.env.GEMINI_API_KEY;

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

      const result: AIScoreResult = {
        toxic: clamp01(parsed.toxic ?? 0),
        hateSpeech: clamp01(parsed.hate_speech ?? 0),
        spam: clamp01(parsed.spam ?? 0),
        reason: parsed.reason || "ok",
      };

      console.log("✅ [AI RESULT]:", result);

      return result;
    } catch (error) {
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

  async analyzeImage(imageUrl: string): Promise<AIScoreResult> {
    try {
      console.log("🤖 [AI] analyzeImage called");
      console.log("📄 Image URL:", imageUrl);

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "no_api_key",
        };
      }

      const fetchImpl = getFetch();

      let imageRes: Response;
      try {
        imageRes = await fetchImpl(imageUrl);
      } catch (err) {
        console.warn("⚠️ [AI] Image fetch failed:", err);
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "image_fetch_error",
        };
      }

      if (!imageRes.ok) {
        console.warn("⚠️ [AI] Image fetch HTTP error:", imageRes.status);
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "image_fetch_error",
        };
      }

      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await imageRes.arrayBuffer();
      } catch (err) {
        console.warn("⚠️ [AI] Image buffer read failed:", err);
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "image_fetch_error",
        };
      }

      const base64String = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = imageRes.headers.get("content-type") || "image/jpeg";

      const prompt = `You are an image content safety classifier for a Vietnamese social network.
Analyze this image and return ONLY valid JSON:
{"toxic": number 0-1, "hate_speech": number 0-1, "spam": number 0-1, "reason": string}
Check for: nudity/18+, violence, weapons, drugs, hate symbols.
If image is safe return low scores and reason="clean".`;

      console.log("📤 [AI] Sending multimodal request...");

      const res = await fetchImpl(`${API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64String,
                  },
                },
              ],
            },
          ],
        }),
      });

      const data = await res.json();

      console.log("📥 [AI] Raw response:", JSON.stringify(data));

      if (!res.ok) {
        console.warn("⚠️ [AI] HTTP error:", res.status);

        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "fallback_http_error",
        };
      }

      const output = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      const parsed = parseAiJson(output);

      if (!parsed) {
        console.warn("⚠️ [AI] Parse failed");

        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "fallback_parse_error",
        };
      }

      const result: AIScoreResult = {
        toxic: clamp01(parsed.toxic ?? 0),
        hateSpeech: clamp01(parsed.hate_speech ?? 0),
        spam: clamp01(parsed.spam ?? 0),
        reason: parsed.reason || "ok",
      };

      console.log("✅ [AI RESULT]:", result);

      return result;
    } catch (error) {
      console.error("💥 [AI ERROR]:", error);

      return {
        toxic: 0,
        hateSpeech: 0,
        spam: 0,
        reason: "fallback_exception",
      };
    }
  },
};
