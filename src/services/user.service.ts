// src/services/user.service.ts

import { Types } from "mongoose";
import { UserModel } from "../models/user.model";
import { PostModel } from "../models/post.model";
import { ReportModel, ReportTargetType } from "../models/report.model";
import { NotFoundError } from "../errors";

export interface UserStatsDto {
  totalPosts: number;
  totalFriends: number;
  totalReportsReceived: number;
  totalReportsMade: number;
}

export const UserService = {
  async getUserStats(userId: string): Promise<UserStatsDto> {
    const oid = new Types.ObjectId(userId);

    const exists = await UserModel.exists({ _id: oid });
    if (!exists) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${userId}`);
    }

    const [totalPosts, postIdRows, totalReportsMade] = await Promise.all([
      PostModel.countDocuments({ userId: oid }),
      PostModel.find({ userId: oid }).select("_id").lean(),
      ReportModel.countDocuments({ reporterId: oid }),
    ]);

    const postIds = postIdRows.map((p) => p._id);
    const totalReportsReceived =
      postIds.length === 0
        ? 0
        : await ReportModel.countDocuments({
            targetType: ReportTargetType.POST,
            targetId: { $in: postIds },
          });

    return {
      totalPosts,
      totalFriends: 0,
      totalReportsReceived,
      totalReportsMade,
    };
  },
};
