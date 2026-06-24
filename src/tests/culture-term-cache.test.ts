import { PostModel } from "../models/post.model";
import { CultureTermMeaningCacheModel } from "../models/culture-term-meaning-cache.model";
import { CultureTranslationService } from "../services/culture-translation/culture-translation.service";
import { SlangDetectorService } from "../services/culture-translation/slang-detector.service";
import { CultureLLMService } from "../services/culture-translation/culture-llm.service";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type AsyncFn = (...args: any[]) => Promise<any>;

async function withPatchedMethod<T extends object, K extends keyof T>(
  target: T,
  key: K,
  replacement: T[K],
  run: () => Promise<void>
) {
  const original = target[key];
  (target as any)[key] = replacement;
  try {
    await run();
  } finally {
    (target as any)[key] = original;
  }
}

async function withPatchedMethods(
  patches: Array<{ target: any; key: string; replacement: any }>,
  run: () => Promise<void>
) {
  const originals = patches.map((patch) => ({
    target: patch.target,
    key: patch.key,
    original: patch.target[patch.key],
  }));

  patches.forEach((patch) => {
    patch.target[patch.key] = patch.replacement;
  });

  try {
    await run();
  } finally {
    originals.forEach(({ target, key, original }) => {
      target[key] = original;
    });
  }
}

async function testSkipsGeminiWhenAllTermsAlreadyCached() {
  let llmCalled = false;
  const updates: any[] = [];

  await withPatchedMethods(
    [
      {
        target: PostModel,
        key: "findById",
        replacement: () => ({
          select: () => ({
            lean: async () => ({
              _id: "post-1",
              contentText: "noob flex",
              cultureAnalyzed: false,
              isHidden: false,
            }),
          }),
        }),
      },
      {
        target: PostModel,
        key: "findByIdAndUpdate",
        replacement: async (...args: any[]) => {
          updates.push(args);
          return null;
        },
      },
      {
        target: SlangDetectorService,
        key: "detectTerms",
        replacement: async () => [
          { term: "noob", startIndex: 0, endIndex: 4 },
          { term: "flex", startIndex: 5, endIndex: 9 },
        ],
      },
      {
        target: CultureTermMeaningCacheModel,
        key: "find",
        replacement: () => ({
          lean: async () => [
            {
              term: "noob",
              meaning: "Nguoi moi",
              origin: "Gaming",
              tone: "trung tÃ­nh",
              contextNote: "Chi nguoi moi",
            },
            {
              term: "flex",
              meaning: "Khoe khoang",
              origin: "MXH",
              tone: "hÃ i hÆ°á»›c",
              contextNote: "Mang y khoe",
            },
          ],
        }),
      },
      {
        target: CultureTermMeaningCacheModel,
        key: "bulkWrite",
        replacement: async () => {
          throw new Error("bulkWrite should not run when everything is cached");
        },
      },
      {
        target: CultureTermMeaningCacheModel,
        key: "updateMany",
        replacement: async () => ({ acknowledged: true }),
      },
      {
        target: CultureLLMService,
        key: "explainTerms",
        replacement: async () => {
          llmCalled = true;
          return [];
        },
      },
    ],
    async () => {
      await CultureTranslationService.analyzePost("post-1");
    }
  );

  assert(!llmCalled, "Expected Gemini to be skipped when all terms are cached");
  assert(updates.length === 1, "Expected one post update");
  assert(updates[0][1].cultureAnalyzed === true, "Expected post to be marked analyzed");
  assert(updates[0][1].culturalTerms.length === 2, "Expected cached terms to be saved");
  assert(
    updates[0][1].culturalTerms[0].meaning === "Nguoi moi",
    "Expected cached meaning to be used"
  );
}

async function testCallsGeminiOnlyForMissingTermsAndMergesResults() {
  const updates: any[] = [];
  const llmCalls: any[] = [];
  const cacheWrites: any[] = [];

  await withPatchedMethods(
    [
      {
        target: PostModel,
        key: "findById",
        replacement: () => ({
          select: () => ({
            lean: async () => ({
              _id: "post-2",
              contentText: "noob flex",
              cultureAnalyzed: false,
              isHidden: false,
            }),
          }),
        }),
      },
      {
        target: PostModel,
        key: "findByIdAndUpdate",
        replacement: async (...args: any[]) => {
          updates.push(args);
          return null;
        },
      },
      {
        target: SlangDetectorService,
        key: "detectTerms",
        replacement: async () => [
          { term: "noob", startIndex: 0, endIndex: 4 },
          { term: "flex", startIndex: 5, endIndex: 9 },
        ],
      },
      {
        target: CultureTermMeaningCacheModel,
        key: "find",
        replacement: () => ({
          lean: async () => [
            {
              term: "noob",
              meaning: "Nguoi moi",
              origin: "Gaming",
              tone: "trung tÃ­nh",
              contextNote: "Chi nguoi moi",
            },
          ],
        }),
      },
      {
        target: CultureTermMeaningCacheModel,
        key: "bulkWrite",
        replacement: async (ops: any[]) => {
          cacheWrites.push(ops);
          return { ok: 1 };
        },
      },
      {
        target: CultureTermMeaningCacheModel,
        key: "updateMany",
        replacement: async () => ({ acknowledged: true }),
      },
      {
        target: CultureLLMService,
        key: "explainTerms",
        replacement: async (terms: string[]) => {
          llmCalls.push(terms);
          return [
            {
              term: "flex",
              meaning: "Khoe khoang",
              origin: "MXH",
              tone: "hÃ i hÆ°á»›c",
              contextNote: "Mang y khoe",
            },
          ];
        },
      },
    ],
    async () => {
      await CultureTranslationService.analyzePost("post-2");
    }
  );

  assert(llmCalls.length === 1, "Expected one Gemini call");
  assert(
    llmCalls[0].length === 1 && llmCalls[0][0] === "flex",
    "Expected Gemini to receive only uncached terms"
  );
  assert(cacheWrites.length === 1, "Expected new Gemini results to be cached");
  assert(updates.length === 1, "Expected one post update");
  assert(updates[0][1].culturalTerms.length === 2, "Expected merged cultural terms");
  assert(
    updates[0][1].culturalTerms[1].meaning === "Khoe khoang",
    "Expected Gemini meaning to be merged for uncached term"
  );
}

async function main() {
  await testSkipsGeminiWhenAllTermsAlreadyCached();
  await testCallsGeminiOnlyForMissingTermsAndMergesResults();
  console.log("culture term cache test passed");
}

main().catch((err) => {
  console.error("culture term cache test failed:", err);
  process.exit(1);
});
