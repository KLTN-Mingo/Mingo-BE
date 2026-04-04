// src/controllers/culture.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { ValidationError } from "../errors";
import { sendSuccess } from "../utils/response";
import { cultureTranslationService } from "../services/culture-translation.service";

/**
 * @route   POST /api/culture/explain
 * @body    { text: string, context?: string }
 */
export const explainCultureTerm = asyncHandler(
  async (req: Request, res: Response) => {
    const { text, context } = req.body as { text?: string; context?: string };

    if (!text?.trim()) {
      throw new ValidationError("text là bắt buộc");
    }
    if (text.length > 2000) {
      throw new ValidationError("text tối đa 2000 ký tự");
    }
    if (context && context.length > 10000) {
      throw new ValidationError("context tối đa 10000 ký tự");
    }

    const result = await cultureTranslationService.explainInContext(
      text.trim(),
      context?.trim()
    );
    sendSuccess(res, result);
  }
);
