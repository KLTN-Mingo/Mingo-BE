// // src/services/culture-translation/culture-llm.service.ts
// export interface LLMTermExplanation {
//   term: string;
//   meaning: string;
//   origin: string;
//   tone: "tích cực" | "trung tính" | "hài hước" | "tiêu cực";
//   contextNote: string;
// }

// const API_URL =
//   "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

// function stripCodeFences(raw: string): string {
//   let s = raw.trim();
//   if (s.startsWith("```")) {
//     s = s.replace(/^```(?:json)?\s*/i, "");
//     s = s.replace(/\s*```\s*$/s, "");
//   }
//   return s.trim();
// }

// function getFetch(): typeof fetch {
//   if (typeof globalThis.fetch === "function")
//     return globalThis.fetch.bind(globalThis);
//   try {
//     return require("node-fetch");
//   } catch {
//     throw new Error("Fetch not available. Use Node 18+.");
//   }
// }

// function buildFallback(terms: string[]): LLMTermExplanation[] {
//   return terms.map((term) => ({
//     term,
//     meaning: "",
//     origin: "",
//     tone: "trung tính" as const,
//     contextNote: "",
//   }));
// }

// export const CultureLLMService = {
//   async explainTerms(
//     terms: string[],
//     postContext: string
//   ): Promise<LLMTermExplanation[]> {
//     if (terms.length === 0) return [];

//     const apiKey = process.env.GEMINI_API_KEY;
//     if (!apiKey) {
//       console.warn("[CultureLLM] No GEMINI_API_KEY — skipping LLM");
//       return buildFallback(terms);
//     }

//     const safeContext = postContext.slice(0, 300).replace(/```/g, "`\u200b``");

//     const prompt = `
// Bạn là chuyên gia văn hóa mạng, tiếng lóng và ngôn ngữ GenZ Việt Nam.

// Ngữ cảnh bài viết mạng xã hội: "${safeContext}"

// Giải thích các từ sau xuất hiện trong bài viết: ${JSON.stringify(terms)}

// Trả về ONLY valid JSON array. KHÔNG markdown. KHÔNG text ngoài JSON:
// [
//   {
//     "term": "từ gốc viết thường",
//     "meaning": "giải thích ngắn gọn tiếng Việt, tối đa 2 câu",
//     "origin": "nguồn gốc: TikTok | Reddit VN | Gaming | Twitter | Chung",
//     "tone": "tích cực | trung tính | hài hước | tiêu cực",
//     "contextNote": "cách dùng trong bài viết này, tối đa 1 câu"
//   }
// ]`;

//     try {
//       console.log(`[CultureLLM] Calling Gemini for ${terms.length} terms...`);
//       const fetchImpl = getFetch();
//       const res = await fetchImpl(`${API_URL}?key=${apiKey}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
//       });

//       const data = (await res.json()) as any;

//       if (!res.ok) {
//         console.warn("[CultureLLM] HTTP error:", res.status);
//         return buildFallback(terms);
//       }

//       const rawText: string =
//         data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
//       const cleaned = stripCodeFences(rawText);
//       const arrMatch = cleaned.match(/\[[\s\S]*\]/);
//       if (!arrMatch) {
//         console.warn("[CultureLLM] No JSON array in response");
//         return buildFallback(terms);
//       }

//       const parsed = JSON.parse(arrMatch[0]) as LLMTermExplanation[];
//       console.log(`✅ [CultureLLM] Explained ${parsed.length} terms`);
//       return parsed;
//     } catch (err) {
//       console.error("💥 [CultureLLM] Error:", err);
//       return buildFallback(terms);
//     }
//   },
// };
// src/services/culture-translation/culture-llm.service.ts
export interface LLMTermExplanation {
  term: string;
  meaning: string;
  origin: string;
  tone: "tích cực" | "trung tính" | "hài hước" | "tiêu cực";
  contextNote: string;
}

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

// Xoay vòng key thay vì random — tránh chọn trúng key đang bị 429
let _keyIndex = 0;
function getApiKey(): string | undefined {
  const keys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter((k): k is string => !!k);
  console.log(`[CultureLLM] Available keys: ${keys.length}`);
  if (keys.length === 0) return undefined;
  const key = keys[_keyIndex % keys.length];
  _keyIndex++;
  return key;
}

function stripCodeFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "");
    s = s.replace(/\s*```\s*$/s, "");
  }
  return s.trim();
}

function getFetch(): typeof fetch {
  if (typeof globalThis.fetch === "function")
    return globalThis.fetch.bind(globalThis);
  try {
    return require("node-fetch");
  } catch {
    throw new Error("Fetch not available. Use Node 18+.");
  }
}

function buildFallback(terms: string[]): LLMTermExplanation[] {
  return terms.map((term) => ({
    term,
    meaning: "",
    origin: "",
    tone: "trung tính" as const,
    contextNote: "",
  }));
}

/**
 * Retry với exponential backoff khi gặp 429.
 * Mỗi lần retry sẽ đổi sang API key khác (nếu có).
 */
async function fetchWithRetry(
  options: RequestInit,
  retries = 3
): Promise<Response> {
  const fetchImpl = getFetch();

  for (let i = 0; i < retries; i++) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("No API key available");

    const url = `${API_URL}?key=${apiKey}`;
    const res = await fetchImpl(url, options);

    if (res.status !== 429) return res;

    const delay = 2000 * Math.pow(2, i); // 2s → 4s → 8s
    console.warn(
      `[CultureLLM] 429 rate limit — retry ${i + 1}/${retries} sau ${delay}ms (key rotated)`
    );
    await new Promise((r) => setTimeout(r, delay));
  }

  throw new Error("[CultureLLM] 429 sau tất cả retries — bỏ qua");
}

export const CultureLLMService = {
  async explainTerms(
    terms: string[],
    postContext: string
  ): Promise<LLMTermExplanation[]> {
    if (terms.length === 0) return [];

    const apiKey = getApiKey();
    if (!apiKey) {
      console.warn("[CultureLLM] No GEMINI_API_KEY — skipping LLM");
      return buildFallback(terms);
    }

    const safeContext = postContext.slice(0, 300).replace(/```/g, "`\u200b``");

    const prompt = `
Bạn là chuyên gia văn hóa mạng, tiếng lóng và ngôn ngữ GenZ Việt Nam.

Ngữ cảnh bài viết mạng xã hội: "${safeContext}"

Giải thích các từ sau xuất hiện trong bài viết: ${JSON.stringify(terms)}

Trả về ONLY valid JSON array. KHÔNG markdown. KHÔNG text ngoài JSON:
[
  {
    "term": "từ gốc viết thường",
    "meaning": "giải thích ngắn gọn tiếng Việt, tối đa 2 câu",
    "origin": "nguồn gốc: TikTok | Reddit VN | Gaming | Twitter | Chung",
    "tone": "tích cực | trung tính | hài hước | tiêu cực",
    "contextNote": "cách dùng trong bài viết này, tối đa 1 câu"
  }
]`;

    const requestOptions: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    };

    try {
      console.log(`[CultureLLM] Calling Gemini for ${terms.length} terms...`);

      const res = await fetchWithRetry(requestOptions);

      const data = (await res.json()) as any;

      if (!res.ok) {
        console.warn("[CultureLLM] HTTP error:", res.status);
        return buildFallback(terms);
      }

      const rawText: string =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
      const cleaned = stripCodeFences(rawText);
      const arrMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!arrMatch) {
        console.warn("[CultureLLM] No JSON array in response");
        return buildFallback(terms);
      }

      const parsed = JSON.parse(arrMatch[0]) as LLMTermExplanation[];
      console.log(`✅ [CultureLLM] Explained ${parsed.length} terms`);
      return parsed;
    } catch (err) {
      console.error("💥 [CultureLLM] Error:", err);
      return buildFallback(terms);
    }
  },
};
