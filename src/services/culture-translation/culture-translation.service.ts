// src/services/culture-translation/culture-translation.service.ts
import { PostModel } from "../../models/post.model";
import { SlangEntryModel } from "../../models/culture-translation.model";
import { SlangDetectorService } from "./slang-detector.service";
import { CultureLLMService } from "./culture-llm.service";
import type { ICultureTerm } from "../../models/culture-translation.model";
import { buildVietnameseRegex, validateRegex } from "../../utils/regex-builder";

export const CultureTranslationService = {
  /** Main pipeline — fire-and-forget after post creation */
  async analyzePost(postId: string): Promise<void> {
    try {
      const post = await PostModel.findById(postId)
        .select("contentText cultureAnalyzed moderationStatus isHidden")
        .lean();

      // FIX: Skip nếu đã analyzed, không tồn tại, hoặc bài đã bị ẩn/reject
      if (!post) return;
      if ((post as any).cultureAnalyzed) return;
      if ((post as any).isHidden) return;

      const content = (post as any).contentText ?? "";
      if (!content.trim()) {
        await PostModel.findByIdAndUpdate(postId, { cultureAnalyzed: true });
        return;
      }

      // STEP 1: Rule-based detect (fast, 0 API cost)
      const detectedTerms = await SlangDetectorService.detectTerms(content);
      console.log(
        `[CultureTranslation] ${detectedTerms.length} terms in post ${postId}`
      );

      if (detectedTerms.length === 0) {
        await PostModel.findByIdAndUpdate(postId, { cultureAnalyzed: true });
        return;
      }

      // STEP 2: Single LLM call
      const uniqueTerms = [
        ...new Set(detectedTerms.map((t) => t.term.toLowerCase())),
      ];
      const explanations = await CultureLLMService.explainTerms(
        uniqueTerms,
        content
      );

      // FIX: Kiểm tra LLM có trả về data thật không
      // Nếu tất cả meaning đều rỗng → LLM fail/fallback → không save, cho phép retry
      const hasRealExplanations = explanations.some(
        (e) => e.meaning && e.meaning.trim() !== ""
      );

      if (!hasRealExplanations) {
        console.warn(
          `⚠️ [CultureTranslation] LLM trả về rỗng (fallback) — bỏ qua, sẽ retry sau cho post ${postId}`
        );
        // KHÔNG set cultureAnalyzed: true → giữ nguyên false → cho phép retry
        return;
      }

      // STEP 3: Merge positions + explanations
      const explainMap = new Map(
        explanations.map((e) => [e.term.toLowerCase(), e])
      );

      const culturalTerms: ICultureTerm[] = detectedTerms.map((dt) => {
        const exp = explainMap.get(dt.term.toLowerCase());
        return {
          term: dt.term,
          startIndex: dt.startIndex,
          endIndex: dt.endIndex,
          meaning: exp?.meaning ?? "",
          origin: exp?.origin ?? "",
          tone: (exp?.tone as ICultureTerm["tone"]) ?? "trung tính",
          contextNote: exp?.contextNote ?? "",
        };
      });

      // STEP 4: Save to MongoDB — chỉ lock khi LLM thành công
      await PostModel.findByIdAndUpdate(postId, {
        culturalTerms,
        cultureAnalyzed: true,
      });

      console.log(
        `✅ [CultureTranslation] Saved ${culturalTerms.length} terms for ${postId}`
      );
    } catch (err) {
      // DO NOT throw — background error must not crash request
      console.error(
        `💥 [CultureTranslation] analyzePost error ${postId}:`,
        err
      );
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

  // ── Admin: dictionary management ──────────────────────────────

  async getDictionary() {
    return SlangEntryModel.find().sort({ createdAt: -1 }).lean();
  },

  async addSlangEntry(data: {
    term: string;
    aliases?: string[];
    regexPattern?: string; // optional — tự build nếu không truyền
    category?: string;
  }) {
    // Tự build regex nếu không truyền vào
    const regexPattern = data.regexPattern || buildVietnameseRegex(data.term);

    // Validate trước khi lưu
    const { valid, error } = validateRegex(regexPattern);
    if (!valid) {
      throw new Error(`regexPattern không hợp lệ: ${error}`);
    }

    // Test thử có match được term không
    const testMatch = new RegExp(regexPattern, "gi").test(data.term);
    if (!testMatch) {
      console.warn(
        `⚠️ Regex không match chính term "${data.term}" — kiểm tra lại`
      );
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
