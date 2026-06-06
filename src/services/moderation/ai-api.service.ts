// src/services/moderation/ai-api.service.ts

import process from "node:process";

export interface AIScoreResult {
  toxic: number;
  hateSpeech: number;
  spam: number;
  reason: string;
}

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
const UPLOAD_URL =
  "https://generativelanguage.googleapis.com/upload/v1beta/files";

const FILES_URL = "https://generativelanguage.googleapis.com/v1beta/files";

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

/**
 * Chờ Gemini File API xử lý xong video (state: ACTIVE)
 * Timeout sau 3 phút
 */
async function waitForFileActive(
  fileUri: string,
  apiKey: string
): Promise<boolean> {
  const fetchImpl = getFetch();
  const fileName = fileUri.split("/").pop();
  const maxAttempts = 18; // 18 * 10s = 3 phút

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 10_000)); // chờ 10s

    const res = await fetchImpl(`${FILES_URL}/${fileName}?key=${apiKey}`);
    if (!res.ok) return false;

    const data = await res.json();
    const state = data?.state ?? data?.file?.state;

    console.log(`⏳ [AI] File state (${i + 1}/${maxAttempts}):`, state);

    if (state === "ACTIVE") return true;
    if (state === "FAILED") return false;
  }

  console.warn("⚠️ [AI] File processing timeout");
  return false;
}

// ────────────────────────────────────────────────────────────
// Main Service
// ────────────────────────────────────────────────────────────

export const AIApiService = {
  async analyzeContent(text: string): Promise<AIScoreResult> {
    try {
      console.log("🤖 [AI] analyzeContent called");
      console.log("📄 Content:", text);

      const API_KEYS = [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
      ].filter(Boolean);

      // Dùng key theo round-robin hoặc random
      const apiKey = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
      if (!apiKey) {
        return { toxic: 0.1, hateSpeech: 0, spam: 0.1, reason: "no_api_key" };
      }

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      const data = await res.json();
      console.log("📥 [AI] Raw response:", JSON.stringify(data));

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

      const API_KEYS = [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
      ].filter(Boolean);

      // Dùng key theo round-robin hoặc random
      const apiKey = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
      if (!apiKey) {
        return { toxic: 0, hateSpeech: 0, spam: 0, reason: "no_api_key" };
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
      const prompt = `You are a strict content safety classifier for a Vietnamese social network.

      Analyze this image carefully and return ONLY valid JSON (no markdown, no explanation):
      {"toxic": number 0-1, "hate_speech": number 0-1, "spam": number 0-1, "reason": string}
      
      SCORING RULES - be strict:
      - toxic >= 0.8: graphic violence, gore, visible wounds/blood, severe injuries, dead bodies
      - toxic >= 0.5: mild blood, fighting, physical harm, disturbing imagery
      - hate_speech >= 0.8: hate symbols, racist content, extremist imagery
      - spam >= 0.8: advertisements, QR codes, watermarked promotional content
      
      ALWAYS flag these with toxic >= 0.8:
      - Blood, wounds, injuries visible on human/animal body
      - Gore or graphic violence of any level
      - Nudity or sexual content
      - Drug use or paraphernalia
      - Weapons being used to harm
      
      If image is completely safe (normal people, food, scenery, etc.) return all scores <= 0.1 and reason="clean".
      Be conservative: when in doubt, score higher rather than lower.`;
      console.log("📤 [AI] Sending multimodal request...");

      const res = await fetchImpl(`${API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: base64String } },
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
      return { toxic: 0, hateSpeech: 0, spam: 0, reason: "fallback_exception" };
    }
  },

  async analyzeVideo(videoUrl: string): Promise<AIScoreResult> {
    try {
      console.log("🤖 [AI] analyzeVideo called");
      console.log("📄 Video URL:", videoUrl);
      const API_KEYS = [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
      ].filter(Boolean);

      // Dùng key theo round-robin hoặc random
      const apiKey = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];

      if (!apiKey) {
        return { toxic: 0, hateSpeech: 0, spam: 0, reason: "no_api_key" };
      }

      const fetchImpl = getFetch();

      // Bước 1: Tải video về buffer
      let videoArrayBuffer: ArrayBuffer;
      try {
        const videoRes = await fetchImpl(videoUrl);
        if (!videoRes.ok) {
          console.warn("⚠️ [AI] Video fetch HTTP error:", videoRes.status);
          return {
            toxic: 0,
            hateSpeech: 0,
            spam: 0,
            reason: "video_fetch_error",
          };
        }
        videoArrayBuffer = await videoRes.arrayBuffer();
        console.log(
          `📦 [AI] Video buffer size: ${videoArrayBuffer.byteLength} bytes`
        );
      } catch (err) {
        console.warn("⚠️ [AI] Video fetch failed:", err);
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "video_fetch_error",
        };
      }

      // Giới hạn 50MB
      const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
      if (videoArrayBuffer.byteLength > MAX_VIDEO_SIZE) {
        console.warn("⚠️ [AI] Video too large:", videoArrayBuffer.byteLength);
        return { toxic: 0, hateSpeech: 0, spam: 0, reason: "video_too_large" };
      }

      // Bước 2: Upload — dùng Uint8Array thay vì Buffer
      const uploadRes = await fetchImpl(`${UPLOAD_URL}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "video/mp4",
          "X-Goog-Upload-Protocol": "raw",
        },
        body: new Uint8Array(videoArrayBuffer), // ← fix ở đây
      });

      if (!uploadRes.ok) {
        console.warn("⚠️ [AI] Video upload failed:", uploadRes.status);
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "video_upload_error",
        };
      }

      const uploadData = await uploadRes.json();
      const fileUri = uploadData?.file?.uri;

      if (!fileUri) {
        console.warn("⚠️ [AI] No fileUri in upload response");
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "video_upload_no_uri",
        };
      }

      console.log("✅ [AI] Video uploaded, fileUri:", fileUri);

      // Bước 3: Chờ Gemini xử lý video xong (state: ACTIVE)
      const isActive = await waitForFileActive(fileUri, apiKey);
      if (!isActive) {
        console.warn("⚠️ [AI] Video file not ready");
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "video_processing_failed",
        };
      }

      // Bước 4: Phân tích video
      console.log("📤 [AI] Sending video analysis request...");

      const prompt = `You are a video content safety classifier for a Vietnamese social network.
Analyze this video and return ONLY valid JSON:
{"toxic": number 0-1, "hate_speech": number 0-1, "spam": number 0-1, "reason": string}
Check for: nudity/18+, violence, weapons, drugs, hate symbols, harmful content.
If video is safe return low scores and reason="clean".`;

      const res = await fetchImpl(`${API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { fileData: { mimeType: "video/mp4", fileUri } },
              ],
            },
          ],
        }),
      });

      const data = await res.json();
      console.log("📥 [AI] Raw video response:", JSON.stringify(data));

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

      console.log("✅ [AI VIDEO RESULT]:", result);
      return result;
    } catch (error) {
      console.error("💥 [AI VIDEO ERROR]:", error);
      return { toxic: 0, hateSpeech: 0, spam: 0, reason: "fallback_exception" };
    }
  },
};
