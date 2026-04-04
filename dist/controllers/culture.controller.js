"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.explainCultureTerm = void 0;
const async_handler_1 = require("../utils/async-handler");
const errors_1 = require("../errors");
const response_1 = require("../utils/response");
const culture_translation_service_1 = require("../services/culture-translation.service");
/**
 * @route   POST /api/culture/explain
 * @body    { text: string, context?: string }
 */
exports.explainCultureTerm = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { text, context } = req.body;
    if (!text?.trim()) {
        throw new errors_1.ValidationError("text là bắt buộc");
    }
    if (text.length > 2000) {
        throw new errors_1.ValidationError("text tối đa 2000 ký tự");
    }
    if (context && context.length > 10000) {
        throw new errors_1.ValidationError("context tối đa 10000 ký tự");
    }
    const result = await culture_translation_service_1.cultureTranslationService.explainInContext(text.trim(), context?.trim());
    (0, response_1.sendSuccess)(res, result);
});
