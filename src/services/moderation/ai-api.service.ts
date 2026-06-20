// src/services/moderation/ai-api.service.ts

import process from "node:process";
import sharp from "sharp";

export interface AIScoreResult {
  toxic: number;
  hateSpeech: number;
  spam: number;
  reason: string;
  violatingIndex?: number | null; // index ảnh vi phạm (chỉ có trong analyzeImages)
}

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
const UPLOAD_URL =
  "https://generativelanguage.googleapis.com/upload/v1beta/files";

const FILES_URL = "https://generativelanguage.googleapis.com/v1beta/files";

const MAX_INLINE_SIZE = 10 * 1024 * 1024; // 10MB per image
const MAX_BATCH_IMAGES = 6; // Tối đa 6 ảnh / batch để không vượt request size

export interface AIScoreResult {
  toxic: number;
  hateSpeech: number;
  spam: number;
  reason: string;
  violatingIndex?: number | null;
  needsManualReview?: boolean; // true khi AI lỗi/không phân tích được → không auto-approve
}

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
  violating_index: number | null;
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
      violating_index:
        parsed.violating_index === null || parsed.violating_index === undefined
          ? null
          : Number(parsed.violating_index),
    };
  } catch {
    return null;
  }
}

function parseAiSeverityJson(text: string): Partial<{
  toxic_level: string;
  hate_speech_level: string;
  spam_level: string;
  reason: string;
}> | null {
  try {
    const cleaned = stripCodeFences(text);
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const payload = jsonMatch ? jsonMatch[0] : cleaned;
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    return {
      toxic_level: String(parsed.toxic_level ?? "none"),
      hate_speech_level: String(parsed.hate_speech_level ?? "none"),
      spam_level: String(parsed.spam_level ?? "none"),
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

function getApiKey(): string | undefined {
  const API_KEYS = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
  ].filter(Boolean) as string[];
  if (!API_KEYS.length) return undefined;
  return API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
}

/**
 * Tính số frame cần lấy dựa trên tổng số frame của GIF.
 */
function calcFrameCount(totalFrames: number): number {
  if (totalFrames <= 10) return totalFrames;
  return Math.min(15, Math.max(5, Math.floor(totalFrames / 10)));
}

type SeverityLevel = "none" | "low" | "medium" | "high" | "severe";

const LEVEL_TO_SCORE: Record<SeverityLevel, number> = {
  none: 0.05,
  low: 0.3,
  medium: 0.55,
  high: 0.75,
  severe: 0.9, // >= AUTO_HIDE (0.8) trong moderation.service.ts
};

function levelToScore(level: unknown): number {
  if (typeof level === "string" && level in LEVEL_TO_SCORE) {
    return LEVEL_TO_SCORE[level as SeverityLevel];
  }
  return 0;
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
    await new Promise((r) => setTimeout(r, 10_000));

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

async function deleteGeminiFile(
  fileUri: string,
  apiKey: string
): Promise<void> {
  try {
    const fileName = fileUri.split("/").pop();
    const fetchImpl = getFetch();
    await fetchImpl(`${FILES_URL}/${fileName}?key=${apiKey}`, {
      method: "DELETE",
    });
    console.log("🗑️ [AI] Deleted Gemini file:", fileName);
  } catch (err) {
    console.warn("⚠️ [AI] Delete Gemini file failed (non-fatal):", err);
  }
}

async function extractGifFrames(
  arrayBuffer: ArrayBuffer,
  maxFrames: number
): Promise<{ base64: string; mimeType: string }[]> {
  try {
    const buffer = Buffer.from(arrayBuffer);

    const image = sharp(buffer, { animated: true });
    const metadata = await image.metadata();
    const totalFrames = metadata.pages ?? 1;

    if (totalFrames <= 1) {
      const base64 = buffer.toString("base64");
      return [{ base64, mimeType: "image/gif" }];
    }

    const frameCount = Math.min(maxFrames, totalFrames);

    const frameIndices = new Set<number>([0, totalFrames - 1]);

    if (frameCount >= 3) {
      frameIndices.add(Math.floor(totalFrames / 2));
    }

    const step = totalFrames / frameCount;
    for (let i = 0; frameIndices.size < frameCount; i++) {
      frameIndices.add(Math.min(totalFrames - 1, Math.round(i * step)));
    }

    const frames = await Promise.all(
      [...frameIndices].map(async (frameIndex) => {
        const extracted = await sharp(buffer, { page: frameIndex })
          .png()
          .toBuffer();
        return {
          base64: extracted.toString("base64"),
          mimeType: "image/png",
        };
      })
    );

    console.log(
      `🎞️ [AI] Extracted ${frames.length}/${totalFrames} frames (maxFrames=${maxFrames})`
    );
    return frames;
  } catch (err) {
    console.warn("⚠️ [AI] Frame extract failed, fallback to full GIF:", err);
    return [
      {
        base64: Buffer.from(arrayBuffer).toString("base64"),
        mimeType: "image/gif",
      },
    ];
  }
}

/**
 * Fetch 1 ảnh về buffer, trả về null nếu thất bại hoặc quá lớn.
 */
async function fetchImageInline(
  url: string,
  fetchImpl: typeof fetch
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) {
      console.warn(`⚠️ [AI] Image fetch HTTP error (${res.status}):`, url);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_INLINE_SIZE) {
      console.warn(
        `⚠️ [AI] Image too large (${arrayBuffer.byteLength} bytes), skipping:`,
        url
      );
      return null;
    }
    const mimeType =
      res.headers.get("content-type")?.split(";")[0].trim() ?? "image/jpeg";
    return {
      base64: Buffer.from(arrayBuffer).toString("base64"),
      mimeType,
    };
  } catch (err) {
    console.warn("⚠️ [AI] Image fetch error:", err);
    return null;
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

      const apiKey = getApiKey();
      if (!apiKey) {
        return { toxic: 0.1, hateSpeech: 0, spam: 0.1, reason: "no_api_key" };
      }

      const safe = String(text).slice(0, 5000).replace(/```/g, "`\u200b``");

      const prompt = `
You are a content safety classifier for a social network.

Return ONLY valid JSON with NO explanation, NO markdown:
{"toxic": number 0-1, "hate_speech": number 0-1, "spam": number 0-1, "reason": string}

IMPORTANT:
- If content is completely safe (greetings, normal conversation, clean topics): return ALL scores <= 0.05 and reason="clean"
- Do NOT return 0.3 for safe content
- Only raise scores when there is clear evidence of violation

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

  /**
   * Phân tích 1 ảnh đơn lẻ (dùng khi chỉ có 1 ảnh hoặc animated GIF).
   */
  async analyzeImage(imageUrl: string): Promise<AIScoreResult> {
    try {
      console.log("🤖 [AI] analyzeImage called");
      console.log("📄 Image URL:", imageUrl);

      const apiKey = getApiKey();
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

      const contentType = imageRes.headers.get("content-type") || "";
      const mimeType = contentType.split(";")[0].trim() || "image/jpeg";

      if (arrayBuffer.byteLength > MAX_INLINE_SIZE) {
        console.warn(
          `⚠️ [AI] Image too large: ${arrayBuffer.byteLength} bytes (${mimeType})`
        );
        return { toxic: 0, hateSpeech: 0, spam: 0, reason: "file_too_large" };
      }

      const isAnimatedGif =
        mimeType === "image/gif" && arrayBuffer.byteLength > 50_000;

      let inlineParts: { inlineData: { mimeType: string; data: string } }[];

      if (isAnimatedGif) {
        console.log("🎞️ [AI] Animated GIF detected, extracting frames...");
        const buffer = Buffer.from(arrayBuffer);
        const metadata = await sharp(buffer, { animated: true }).metadata();
        const totalFrames = metadata.pages ?? 1;
        const maxFrames = calcFrameCount(totalFrames);

        console.log(
          `🎞️ [AI] Total frames: ${totalFrames}, will extract: ${maxFrames}`
        );

        const frames = await extractGifFrames(arrayBuffer, maxFrames);
        inlineParts = frames.map((f) => ({
          inlineData: { mimeType: f.mimeType, data: f.base64 },
        }));
        console.log(`🎞️ [AI] Scanning ${frames.length} frames`);
      } else {
        inlineParts = [
          {
            inlineData: {
              mimeType,
              data: Buffer.from(arrayBuffer).toString("base64"),
            },
          },
        ];
      }

      const prompt = `You are a strict content safety classifier for a Vietnamese social network.

      Analyze ${isAnimatedGif ? "these GIF frames (check ALL frames carefully)" : "this image"} and return ONLY valid JSON (no markdown, no explanation):
      {
        "toxic_level": "none" | "low" | "medium" | "high" | "severe",
        "hate_speech_level": "none" | "low" | "medium" | "high",
        "spam_level": "none" | "low" | "medium" | "high",
        "reason": string
      }
      
      CLASSIFICATION GUIDE:
      - toxic_level "severe": visible blood, open wounds, gore, dead bodies, dismemberment, nudity/sexual content, drug use, weapons actively harming someone
      - toxic_level "high": fighting with visible impact, mild blood, disturbing/shocking imagery
      - toxic_level "medium": aggressive behavior, physical harm implied, no visible injury
      - toxic_level "low": mild tension, no real harm shown
      - toxic_level "none": completely safe (cartoon, animal, food, scenery, normal people, etc.)
      
      - hate_speech_level "high": hate symbols, racist/extremist imagery
      - spam_level "high": advertisements, QR codes, watermarked promotional content
      ${isAnimatedGif ? "\nIMPORTANT: Classify based on the WORST frame found across ALL frames." : ""}`;

      const res = await fetchImpl(`${API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, ...inlineParts] }],
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
      const parsed = parseAiSeverityJson(output);

      if (!parsed) {
        console.warn("⚠️ [AI] Parse failed");
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "fallback_parse_error",
          needsManualReview: true,
        };
      }

      const result: AIScoreResult = {
        toxic: levelToScore(parsed.toxic_level),
        hateSpeech: levelToScore(parsed.hate_speech_level),
        spam: levelToScore(parsed.spam_level),
        reason: parsed.reason || "ok",
      };

      console.log("✅ [AI RESULT]:", result);
      return result;
    } catch (error) {
      console.error("💥 [AI ERROR]:", error);
      return { toxic: 0, hateSpeech: 0, spam: 0, reason: "fallback_exception" };
    }
  },

  /**
   * Phân tích nhiều ảnh trong 1 request Gemini duy nhất.
   * - Tối đa MAX_BATCH_IMAGES ảnh (ảnh thừa bị bỏ qua)
   * - Ảnh nào fetch thất bại hoặc quá lớn sẽ bị skip, không làm hỏng cả batch
   * - Trả về score cao nhất trong tất cả ảnh + violatingIndex
   */
  async analyzeImages(imageUrls: string[]): Promise<AIScoreResult> {
    const FALLBACK: AIScoreResult = {
      toxic: 0,
      hateSpeech: 0,
      spam: 0,
      reason: "fallback_exception",
    };

    try {
      if (!imageUrls.length) {
        return { toxic: 0, hateSpeech: 0, spam: 0, reason: "no_images" };
      }

      console.log(`🤖 [AI] analyzeImages called (${imageUrls.length} URLs)`);

      const apiKey = getApiKey();
      if (!apiKey) {
        return { toxic: 0, hateSpeech: 0, spam: 0, reason: "no_api_key" };
      }

      const fetchImpl = getFetch();

      // Giới hạn MAX_BATCH_IMAGES ảnh để không vượt request size Gemini
      const urlsToScan = imageUrls.slice(0, MAX_BATCH_IMAGES);
      if (imageUrls.length > MAX_BATCH_IMAGES) {
        console.warn(
          `⚠️ [AI] ${imageUrls.length} images > limit ${MAX_BATCH_IMAGES}, only scanning first ${MAX_BATCH_IMAGES}`
        );
      }

      // Fetch tất cả ảnh song song
      const fetchResults = await Promise.allSettled(
        urlsToScan.map((url) => fetchImageInline(url, fetchImpl))
      );

      // Map index gốc → inlinePart (bỏ qua ảnh null)
      interface IndexedPart {
        originalIndex: number;
        inlineData: { mimeType: string; data: string };
      }

      const indexedParts: IndexedPart[] = [];
      fetchResults.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value) {
          indexedParts.push({
            originalIndex: i,
            inlineData: {
              mimeType: r.value.mimeType,
              data: r.value.base64,
            },
          });
        } else {
          console.warn(
            `⚠️ [AI] Skipping image[${i}] (fetch failed or too large)`
          );
        }
      });

      if (indexedParts.length === 0) {
        console.warn("⚠️ [AI] All images failed to fetch, skipping batch scan");
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "all_images_failed",
        };
      }

      console.log(
        `📤 [AI] Sending batch request: ${indexedParts.length}/${urlsToScan.length} images loaded`
      );

      // Đánh số lại các ảnh thực sự gửi lên (0-based trong batch)
      // và ghi chú original index để map lại sau
      const batchCount = indexedParts.length;
      const inlineParts = indexedParts.map((p) => ({
        inlineData: p.inlineData,
      }));

      const prompt = `You are a video content safety classifier for a Vietnamese social network.

      Analyze this video and return ONLY valid JSON (no markdown, no explanation):
      {
        "toxic_level": "none" | "low" | "medium" | "high" | "severe",
        "hate_speech_level": "none" | "low" | "medium" | "high",
        "spam_level": "none" | "low" | "medium" | "high",
        "reason": string
      }
      
      CLASSIFICATION GUIDE:
      - toxic_level "severe": visible blood, open wounds, gore, dead bodies, dismemberment, nudity/sexual content, drug use, weapons actively harming someone
      - toxic_level "high": fighting with visible impact, mild blood, disturbing/shocking imagery
      - toxic_level "medium": aggressive behavior, physical harm implied, no visible injury
      - toxic_level "low": mild tension, no real harm shown
      - toxic_level "none": completely safe content
      
      - hate_speech_level "high": hate symbols, racist/extremist content
      - spam_level "high": advertisements, QR codes, scam patterns
      
      Check the FULL video from start to end, not just the first few seconds — violations may appear midway or near the end.
      Classify based on the WORST moment found anywhere in the video.`;

      const fetchImplForGemini = getFetch();
      const res = await fetchImplForGemini(`${API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }, ...inlineParts],
            },
          ],
        }),
      });

      const data = await res.json();
      console.log("📥 [AI] Raw batch response:", JSON.stringify(data));

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
      console.log("📥 [AI] Video analysis output:", output);

      const parsed = parseAiSeverityJson(output);

      if (!parsed) {
        console.warn("⚠️ [AI] Parse failed");
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "fallback_parse_error",
          needsManualReview: true,
        };
      }

      const result: AIScoreResult = {
        toxic: levelToScore(parsed.toxic_level),
        hateSpeech: levelToScore(parsed.hate_speech_level),
        spam: levelToScore(parsed.spam_level),
        reason: parsed.reason || "ok",
      };

      console.log("✅ [AI VIDEO RESULT]:", result);
      return result;
    } catch (error) {
      console.error("💥 [AI BATCH ERROR]:", error);
      return FALLBACK;
    }
  },

  async analyzeVideo(videoUrl: string): Promise<AIScoreResult> {
    let fileUriToCleanup: string | null = null;
    let apiKeyForCleanup: string | null = null;

    try {
      console.log("🤖 [AI] analyzeVideo called");
      console.log("📄 Video URL:", videoUrl);

      const apiKey = getApiKey();
      if (!apiKey) {
        return { toxic: 0, hateSpeech: 0, spam: 0, reason: "no_api_key" };
      }
      apiKeyForCleanup = apiKey;

      const fetchImpl = getFetch();

      let videoArrayBuffer: ArrayBuffer;
      let videoMimeType = "video/mp4";
      try {
        const videoRes = await fetchImpl(videoUrl);
        if (!videoRes.ok) {
          console.warn("⚠️ [AI] Video fetch HTTP error:", videoRes.status);
          return {
            toxic: 0,
            hateSpeech: 0,
            spam: 0,
            reason: "video_fetch_error",
            needsManualReview: true,
          };
        }
        videoArrayBuffer = await videoRes.arrayBuffer();
        videoMimeType =
          videoRes.headers.get("content-type")?.split(";")[0].trim() ||
          "video/mp4";
        console.log(
          `📦 [AI] Video buffer size: ${videoArrayBuffer.byteLength} bytes, type: ${videoMimeType}`
        );
      } catch (err) {
        console.warn("⚠️ [AI] Video fetch failed:", err);
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "video_fetch_error",
          needsManualReview: true,
        };
      }

      const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
      if (videoArrayBuffer.byteLength > MAX_VIDEO_SIZE) {
        console.warn("⚠️ [AI] Video too large:", videoArrayBuffer.byteLength);
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "video_too_large",
          needsManualReview: true,
        };
      }

      const uploadRes = await fetchImpl(`${UPLOAD_URL}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": videoMimeType,
          "X-Goog-Upload-Protocol": "raw",
        },
        body: new Uint8Array(videoArrayBuffer),
      });

      if (!uploadRes.ok) {
        console.warn("⚠️ [AI] Video upload failed:", uploadRes.status);
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "video_upload_error",
          needsManualReview: true,
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
          needsManualReview: true,
        };
      }

      console.log("✅ [AI] Video uploaded, fileUri:", fileUri);
      fileUriToCleanup = fileUri; // đánh dấu để xóa ở finally

      const isActive = await waitForFileActive(fileUri, apiKey);
      if (!isActive) {
        console.warn("⚠️ [AI] Video file not ready");
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "video_processing_failed",
          needsManualReview: true,
        };
      }

      console.log("📤 [AI] Sending video analysis request...");

      const prompt = `You are a STRICT video content safety classifier for a Vietnamese social network. Be conservative and err toward HIGHER scores when in doubt.

Return ONLY valid JSON (no markdown, no explanation):
{"toxic": number 0-1, "hate_speech": number 0-1, "spam": number 0-1, "reason": string}

SCORING RULES — be strict, do not soften scores for "context" or "it's brief":
- toxic >= 0.9: clear visible blood, open wounds, gore, severe injury, dead bodies, dismemberment, graphic violence, weapons actively harming someone, nudity/sexual content
- toxic >= 0.7: fighting with visible impact, mild blood, disturbing/shocking imagery, simulated harm that looks real, drug use
- toxic >= 0.4: aggressive behavior, verbal violence, intense conflict without visible injury
- hate_speech >= 0.8: hate symbols, racist/discriminatory content, extremist messaging
- spam >= 0.8: ads, QR codes, promotional watermarks, scam patterns

IMPORTANT CALIBRATION:
- If you can SEE blood, wounds, or injury on a person/animal at ANY point in the video — even briefly, even partially obscured — toxic MUST be >= 0.8, not 0.7.
- Do not round down because the disturbing content is short or only in part of the video. The presence of the content matters more than its duration.
- Your "reason" text and your numeric score MUST match in severity. If your reason mentions "gore", "blood", or "physical trauma", toxic must be >= 0.85. Do not write a severe reason with a moderate score.

Check the FULL video from start to end, not just the first few seconds — violations may appear midway or near the end.

If the video is completely safe, return ALL scores <= 0.05 and reason="clean".`;

      const res = await fetchImpl(`${API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { fileData: { mimeType: videoMimeType, fileUri } },
              ],
            },
          ],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.warn("⚠️ [AI] HTTP error:", res.status);
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "fallback_http_error",
          needsManualReview: true,
        };
      }

      const output = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      console.log("📥 [AI] Video analysis output:", output);

      const parsed = parseAiJson(output);

      if (!parsed) {
        console.warn("⚠️ [AI] Parse failed");
        return {
          toxic: 0,
          hateSpeech: 0,
          spam: 0,
          reason: "fallback_parse_error",
          needsManualReview: true,
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
      return {
        toxic: 0,
        hateSpeech: 0,
        spam: 0,
        reason: "fallback_exception",
        needsManualReview: true,
      };
    } finally {
      // Dọn file đã upload lên Gemini, không chặn việc trả kết quả
      if (fileUriToCleanup && apiKeyForCleanup) {
        void deleteGeminiFile(fileUriToCleanup, apiKeyForCleanup);
      }
    }
  },
};
