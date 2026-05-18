import { Request, Response } from "express";
import { ValidationError } from "../errors";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess } from "../utils/response";
import { SearchService, type GlobalSearchType } from "../services/search.service";

const ALLOWED_SEARCH_TYPES: GlobalSearchType[] = ["all", "users", "posts"];

export const searchGlobal = asyncHandler(async (req: Request, res: Response) => {
  const {
    q,
    page: pageStr,
    limit: limitStr,
    type: typeStr,
  } = req.query as Record<string, string>;

  const query = q?.trim();
  if (!query) {
    throw new ValidationError("Vui lòng truyền từ khóa tìm kiếm qua query `q`");
  }

  if (query.length < 2) {
    throw new ValidationError("Từ khóa tìm kiếm phải có ít nhất 2 ký tự");
  }

  if (query.length > 100) {
    throw new ValidationError("Từ khóa tìm kiếm không được vượt quá 100 ký tự");
  }

  const page = Number.parseInt(pageStr || "1", 10) || 1;
  const limit = Number.parseInt(limitStr || "10", 10) || 10;
  const type = (typeStr || "all") as GlobalSearchType;

  if (page < 1) {
    throw new ValidationError("Số trang phải lớn hơn 0");
  }

  if (limit < 1 || limit > 20) {
    throw new ValidationError("Limit phải từ 1 đến 20");
  }

  if (!ALLOWED_SEARCH_TYPES.includes(type)) {
    throw new ValidationError("type chỉ chấp nhận: all, users, posts");
  }

  const currentUserId = (req as any).user?.userId as string | undefined;
  const result = await SearchService.globalSearch({
    query,
    page,
    limit,
    type,
    currentUserId,
  });

  sendSuccess(res, result, "Tìm kiếm thành công");
});
