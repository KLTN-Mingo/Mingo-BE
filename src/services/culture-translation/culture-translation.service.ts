// src/services/culture-translation/culture-translation.service.ts
import { PostModel } from "../../models/post.model";
import { SlangEntryModel } from "../../models/culture-translation.model";
import { CultureTermMeaningCacheModel } from "../../models/culture-term-meaning-cache.model";
import { SlangDetectorService } from "./slang-detector.service";
import { CultureLLMService } from "./culture-llm.service";
import type { ICultureTerm } from "../../models/culture-translation.model";
import { buildVietnameseRegex, validateRegex } from "../../utils/regex-builder";

type TermExplanation = Pick<
  ICultureTerm,
  "term" | "meaning" | "origin" | "tone" | "contextNote"
>;

const DEFAULT_TONE: ICultureTerm["tone"] = "trung tính";

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

function hasMeaning(explanation: Pick<ICultureTerm, "meaning">): boolean {
  return explanation.meaning.trim() !== "";
}

function toTermExplanation(entry: Partial<TermExplanation>): TermExplanation {
  return {
    term: normalizeTerm(entry.term ?? ""),
    meaning: entry.meaning ?? "",
    origin: entry.origin ?? "",
    tone: (entry.tone as ICultureTerm["tone"]) ?? DEFAULT_TONE,
    contextNote: entry.contextNote ?? "",
  };
}

export const CultureTranslationService = {
  /** Main pipeline - fire-and-forget after post creation */
  async analyzePost(postId: string): Promise<void> {
    try {
      const post = await PostModel.findById(postId)
        .select("contentText cultureAnalyzed moderationStatus isHidden")
        .lean();

      if (!post) return;
      if ((post as any).cultureAnalyzed) return;
      if ((post as any).isHidden) return;

      const content = (post as any).contentText ?? "";
      if (!content.trim()) {
        await PostModel.findByIdAndUpdate(postId, { cultureAnalyzed: true });
        return;
      }

      const detectedTerms = await SlangDetectorService.detectTerms(content);
      console.log(
        `[CultureTranslation] ${detectedTerms.length} terms in post ${postId}`
      );

      if (detectedTerms.length === 0) {
        await PostModel.findByIdAndUpdate(postId, { cultureAnalyzed: true });
        return;
      }

      const uniqueTerms = [...new Set(detectedTerms.map((t) => normalizeTerm(t.term)))];
      const cachedExplanations = (await CultureTermMeaningCacheModel.find({
        term: { $in: uniqueTerms },
      }).lean()) as unknown as TermExplanation[];

      const cachedExplainMap = new Map(
        cachedExplanations.map((entry) => [normalizeTerm(entry.term), entry])
      );
      const missingTerms = uniqueTerms.filter((term) => !cachedExplainMap.has(term));

      let freshExplanations: TermExplanation[] = [];
      if (missingTerms.length > 0) {
        const llmExplanations = await CultureLLMService.explainTerms(
          missingTerms,
          content
        );
        freshExplanations = llmExplanations
          .map((entry) => toTermExplanation(entry))
          .filter((entry) => hasMeaning(entry));
      }

      const hasRealExplanations =
        cachedExplanations.some((entry) => hasMeaning(entry)) ||
        freshExplanations.some((entry) => hasMeaning(entry));

      if (!hasRealExplanations) {
        console.warn(
          `[CultureTranslation] No real explanations available - retry later for post ${postId}`
        );
        return;
      }

      if (freshExplanations.length > 0) {
        try {
          await (CultureTermMeaningCacheModel as any).bulkWrite(
            freshExplanations.map((entry) => ({
              updateOne: {
                filter: { term: normalizeTerm(entry.term) },
                update: {
                  $set: {
                    meaning: entry.meaning,
                    origin: entry.origin,
                    tone: entry.tone,
                    contextNote: entry.contextNote,
                    source: "gemini",
                    lastUsedAt: new Date(),
                  },
                  $inc: { hitCount: 1 },
                },
                upsert: true,
              },
            }))
          );
        } catch (cacheErr) {
          console.error("[CultureTranslation] cache upsert error:", cacheErr);
        }
      }

      if (cachedExplanations.length > 0) {
        void (CultureTermMeaningCacheModel as any)
          .updateMany(
            {
              term: {
                $in: cachedExplanations.map((entry) => normalizeTerm(entry.term)),
              },
            },
            {
              $inc: { hitCount: 1 },
              $set: { lastUsedAt: new Date() },
            }
          )
          .catch((cacheErr: unknown) => {
            console.error("[CultureTranslation] cache hit update error:", cacheErr);
          });
      }

      const explainMap = new Map(
        [...cachedExplanations, ...freshExplanations].map((entry) => [
          normalizeTerm(entry.term),
          entry,
        ])
      );

      const culturalTerms: ICultureTerm[] = detectedTerms.map((dt) => {
        const exp = explainMap.get(normalizeTerm(dt.term));
        return {
          term: dt.term,
          startIndex: dt.startIndex,
          endIndex: dt.endIndex,
          meaning: exp?.meaning ?? "",
          origin: exp?.origin ?? "",
          tone: exp?.tone ?? DEFAULT_TONE,
          contextNote: exp?.contextNote ?? "",
        };
      });

      await PostModel.findByIdAndUpdate(postId, {
        culturalTerms,
        cultureAnalyzed: true,
      });

      console.log(
        `[CultureTranslation] Saved ${culturalTerms.length} terms for ${postId}`
      );
    } catch (err) {
      console.error(`[CultureTranslation] analyzePost error ${postId}:`, err);
    }
  },

  /** Reset + re-analyze when user edits post */
  async reAnalyzePost(postId: string): Promise<void> {
    await PostModel.findByIdAndUpdate(postId, {
      culturalTerms: [],
      cultureAnalyzed: false,
    });
    await CultureTranslationService.analyzePost(postId);
  },

  async getDictionary() {
    return SlangEntryModel.find().sort({ createdAt: -1 }).lean();
  },

  async addSlangEntry(data: {
    term: string;
    aliases?: string[];
    regexPattern?: string;
    category?: string;
  }) {
    const regexPattern = data.regexPattern || buildVietnameseRegex(data.term);

    const { valid, error } = validateRegex(regexPattern);
    if (!valid) {
      throw new Error(`regexPattern khong hop le: ${error}`);
    }

    const testMatch = new RegExp(regexPattern, "gi").test(data.term);
    if (!testMatch) {
      console.warn(`Regex khong match chinh term "${data.term}" - kiem tra lai`);
    }

    const entry = new SlangEntryModel({ ...data, regexPattern });
    await entry.save();
    SlangDetectorService.clearCache();
    return entry;
  },

  async toggleSlangEntry(id: string) {
    const entry = await SlangEntryModel.findById(id);
    if (!entry) return null;
    entry.isActive = !entry.isActive;
    await entry.save();
    SlangDetectorService.clearCache();
    return entry;
  },

  async reportTerm(term: string) {
    return SlangEntryModel.findOneAndUpdate(
      { term: term.toLowerCase() },
      { $inc: { reportCount: 1 } },
      { new: true }
    );
  },
};
