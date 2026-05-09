import { ModerationStatus } from "../models/post.model";
import { UserModel } from "../models/user.model";
import { PostModel } from "../models/post.model";

export type GlobalSearchType = "all" | "users" | "posts";

export interface SearchUserItem {
  id: string;
  name?: string;
  avatar?: string;
  bio?: string;
  verified: boolean;
  followersCount: number;
  postsCount: number;
}

export interface SearchPostItem {
  id: string;
  contentText?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: Date;
  user: {
    id: string;
    name?: string;
    avatar?: string;
    verified: boolean;
  } | null;
}

export interface GlobalSearchResult {
  query: string;
  users: SearchUserItem[];
  posts: SearchPostItem[];
  pagination: {
    page: number;
    limit: number;
    usersTotal: number;
    postsTotal: number;
  };
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchRegex(query: string): RegExp {
  return new RegExp(escapeRegex(query), "i");
}

export const SearchService = {
  async globalSearch(params: {
    query: string;
    page: number;
    limit: number;
    type: GlobalSearchType;
    currentUserId?: string;
  }): Promise<GlobalSearchResult> {
    const { query, page, limit, type, currentUserId } = params;
    const skip = (page - 1) * limit;
    const regex = buildSearchRegex(query);

    const shouldSearchUsers = type === "all" || type === "users";
    const shouldSearchPosts = type === "all" || type === "posts";

    const usersPromise = shouldSearchUsers
      ? (async () => {
          const textFilter = {
            $text: { $search: query },
            isActive: true,
            isBlocked: false,
          };
          const regexFilter = {
            isActive: true,
            isBlocked: false,
            $or: [{ name: regex }, { email: regex }, { phoneNumber: regex }],
          };

          const [textUsers, textTotal] = await Promise.all([
            UserModel.find(textFilter, { score: { $meta: "textScore" } })
              .sort({ score: { $meta: "textScore" }, followersCount: -1 })
              .skip(skip)
              .limit(limit)
              .select("name avatar bio verified followersCount postsCount")
              .lean(),
            UserModel.countDocuments(textFilter),
          ]);

          if (textUsers.length > 0 || textTotal > 0) {
            return {
              items: textUsers.map((u: any) => ({
                id: u._id.toString(),
                name: u.name,
                avatar: u.avatar,
                bio: u.bio,
                verified: !!u.verified,
                followersCount: u.followersCount ?? 0,
                postsCount: u.postsCount ?? 0,
              })),
              total: textTotal,
            };
          }

          const [regexUsers, regexTotal] = await Promise.all([
            UserModel.find(regexFilter)
              .sort({ followersCount: -1, createdAt: -1 })
              .skip(skip)
              .limit(limit)
              .select("name avatar bio verified followersCount postsCount")
              .lean(),
            UserModel.countDocuments(regexFilter),
          ]);

          return {
            items: regexUsers.map((u: any) => ({
              id: u._id.toString(),
              name: u.name,
              avatar: u.avatar,
              bio: u.bio,
              verified: !!u.verified,
              followersCount: u.followersCount ?? 0,
              postsCount: u.postsCount ?? 0,
            })),
            total: regexTotal,
          };
        })()
      : Promise.resolve({ items: [] as SearchUserItem[], total: 0 });

    const postsPromise = shouldSearchPosts
      ? (async () => {
          const visibilityFilter = currentUserId
            ? {
                $or: [
                  { visibility: "public" },
                  { userId: currentUserId },
                ],
              }
            : { visibility: "public" };

          const baseMatch = {
            isHidden: false,
            moderationStatus: ModerationStatus.APPROVED,
            ...visibilityFilter,
          };

          const textMatch = {
            ...baseMatch,
            $text: { $search: query },
          };

          const [textRows, textTotal] = await Promise.all([
            PostModel.aggregate([
              { $match: textMatch as any },
              { $addFields: { score: { $meta: "textScore" } } },
              { $sort: { score: -1, createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $lookup: {
                  from: "users",
                  localField: "userId",
                  foreignField: "_id",
                  as: "user",
                  pipeline: [{ $project: { name: 1, avatar: 1, verified: 1 } }],
                },
              },
              {
                $project: {
                  _id: 1,
                  contentText: 1,
                  likesCount: 1,
                  commentsCount: 1,
                  sharesCount: 1,
                  createdAt: 1,
                  user: { $arrayElemAt: ["$user", 0] },
                },
              },
            ]),
            PostModel.countDocuments(textMatch),
          ]);

          if (textRows.length > 0 || textTotal > 0) {
            return {
              items: textRows.map((p: any) => ({
                id: p._id.toString(),
                contentText: p.contentText,
                likesCount: p.likesCount ?? 0,
                commentsCount: p.commentsCount ?? 0,
                sharesCount: p.sharesCount ?? 0,
                createdAt: p.createdAt,
                user: p.user
                  ? {
                      id: p.user._id.toString(),
                      name: p.user.name,
                      avatar: p.user.avatar,
                      verified: !!p.user.verified,
                    }
                  : null,
              })),
              total: textTotal,
            };
          }

          const regexMatch = {
            ...baseMatch,
            contentText: regex,
          };

          const [regexRows, regexTotal] = await Promise.all([
            PostModel.aggregate([
              { $match: regexMatch as any },
              { $sort: { likesCount: -1, commentsCount: -1, createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $lookup: {
                  from: "users",
                  localField: "userId",
                  foreignField: "_id",
                  as: "user",
                  pipeline: [{ $project: { name: 1, avatar: 1, verified: 1 } }],
                },
              },
              {
                $project: {
                  _id: 1,
                  contentText: 1,
                  likesCount: 1,
                  commentsCount: 1,
                  sharesCount: 1,
                  createdAt: 1,
                  user: { $arrayElemAt: ["$user", 0] },
                },
              },
            ]),
            PostModel.countDocuments(regexMatch),
          ]);

          return {
            items: regexRows.map((p: any) => ({
              id: p._id.toString(),
              contentText: p.contentText,
              likesCount: p.likesCount ?? 0,
              commentsCount: p.commentsCount ?? 0,
              sharesCount: p.sharesCount ?? 0,
              createdAt: p.createdAt,
              user: p.user
                ? {
                    id: p.user._id.toString(),
                    name: p.user.name,
                    avatar: p.user.avatar,
                    verified: !!p.user.verified,
                  }
                : null,
            })),
            total: regexTotal,
          };
        })()
      : Promise.resolve({ items: [] as SearchPostItem[], total: 0 });

    const [usersResult, postsResult] = await Promise.all([
      usersPromise,
      postsPromise,
    ]);

    return {
      query,
      users: usersResult.items,
      posts: postsResult.items,
      pagination: {
        page,
        limit,
        usersTotal: usersResult.total,
        postsTotal: postsResult.total,
      },
    };
  },
};
