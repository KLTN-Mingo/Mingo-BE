// src/controllers/culture.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess } from "../utils/response";
import { NotFoundError, ValidationError } from "../errors";
import { PostModel } from "../models/post.model";
import { CultureTranslationService } from "../services/culture-translation/culture-translation.service";

// User: get culturalTerms of a post (frontend calls when opening a post)
export const getPostCultureTerms = asyncHandler(
  async (req: Request, res: Response) => {
    const postId = req.params.postId as string;
    const post = await PostModel
      .findById(postId)
      .select("culturalTerms cultureAnalyzed")
      .lean();

    if (!post) throw new NotFoundError("Không tìm thấy bài viết");

    sendSuccess(res, {
      analyzed: (post as any).cultureAnalyzed,
      terms:    (post as any).culturalTerms ?? [],
    });
  }
);

// User: trigger re-analyze after post edit
export const reAnalyzePost = asyncHandler(
  async (req: Request, res: Response) => {
    await CultureTranslationService.reAnalyzePost(req.params.postId as string);
    sendSuccess(res, null, "Đã phân tích lại thành công");
  }
);

// User: report incorrect explanation
export const reportTerm = asyncHandler(
  async (req: Request, res: Response) => {
    const { term } = req.body as { term: string };
    if (!term?.trim()) throw new ValidationError("Thiếu thông tin từ cần báo cáo");
    await CultureTranslationService.reportTerm(term);
    sendSuccess(res, null, "Đã gửi báo cáo");
  }
);

// Admin: view dictionary
export const getDictionary = asyncHandler(
  async (_req: Request, res: Response) => {
    const entries = await CultureTranslationService.getDictionary();
    sendSuccess(res, entries);
  }
);

// Admin: add new term
export const addSlangEntry = asyncHandler(
  async (req: Request, res: Response) => {
    const { term, aliases, regexPattern, category } = req.body;
    if (!term || !regexPattern)
      throw new ValidationError("term và regexPattern là bắt buộc");
    const entry = await CultureTranslationService.addSlangEntry({
      term, aliases, regexPattern, category,
    });
    sendSuccess(res, entry, "Đã thêm từ mới", 201);
  }
);

// Admin: enable/disable term
export const toggleSlangEntry = asyncHandler(
  async (req: Request, res: Response) => {
    const entry = await CultureTranslationService.toggleSlangEntry(req.params.id as string);
    if (!entry) throw new NotFoundError("Không tìm thấy từ");
    sendSuccess(res, entry, `Đã ${entry.isActive ? "bật" : "tắt"} từ này`);
  }
);
