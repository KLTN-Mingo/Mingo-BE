export interface PostShareMessagePayloadInput {
  postId: string;
  shareId: string;
  message?: string;
  createdAt: Date;
}

export function buildPostShareMessageText(input: PostShareMessagePayloadInput): string {
  return JSON.stringify({
    type: "post_share",
    postId: input.postId,
    shareId: input.shareId,
    message: input.message?.trim() ?? "",
    createdAt: input.createdAt.toISOString(),
  });
}
