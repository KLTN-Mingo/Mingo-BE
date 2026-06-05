import { Types } from "mongoose";
import { ModerationStatus, PostVisibility } from "../models/post.model";
import { toPostResponse } from "../dtos/post.dto";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function testPostResponseIncludesCultureFields() {
  const culturalTerms = [
    {
      term: "noob",
      startIndex: 0,
      endIndex: 4,
      meaning: "Nguoi moi choi",
      origin: "Gaming",
      tone: "trung tính" as const,
      contextNote: "Dung trong ngu canh game",
    },
  ];

  const response = toPostResponse({
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    contentText: "noob player",
    visibility: PostVisibility.PUBLIC,
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    savesCount: 0,
    viewsCount: 0,
    moderationStatus: ModerationStatus.APPROVED,
    isHidden: false,
    isEdited: false,
    culturalTerms,
    cultureAnalyzed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  assert(response.cultureAnalyzed === true, "Expected cultureAnalyzed to be returned");
  assert(response.culturalTerms?.length === 1, "Expected culturalTerms to be returned");
  assert(response.culturalTerms?.[0]?.term === "noob", "Expected cultural term data to be preserved");
}

testPostResponseIncludesCultureFields()
  .then(() => console.log("post culture response test passed"))
  .catch((err) => {
    console.error("post culture response test failed:", err);
    process.exit(1);
  });
