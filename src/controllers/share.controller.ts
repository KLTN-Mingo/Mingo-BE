import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess } from "../utils/response";
import { RepostDto, SendDMShareDto } from "../dtos/share.dto";
import { ShareService } from "../services/share.service";

export const sendShareMessage = asyncHandler(
  async (req: Request, res: Response) => {
    const senderId = (req as any).user?.userId as string;
    const dto = req.body as SendDMShareDto;

    const data = await ShareService.sendDM(senderId, dto);
    sendSuccess(res, data, "Chia sẻ bài viết qua DM thành công", 201);
  }
);

export const repostPost = asyncHandler(async (req: Request, res: Response) => {
  const authorId = (req as any).user?.userId as string;
  const dto = req.body as RepostDto;

  const data = await ShareService.repost(authorId, dto);
  sendSuccess(res, data, "Repost bài viết thành công", 201);
});
