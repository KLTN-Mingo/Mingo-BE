# Database ERD (Entity Relationship Diagram)

MongoDB + Mongoose. Tài liệu mô tả các collection, khóa chính `_id`, reference, và quan hệ hiện dùng trong code.

---

## Mermaid ERD

```mermaid
erDiagram
  User {
    ObjectId _id PK
    string phoneNumber UK
    string email UK_sparse
    string passwordHash
    string name
    string bio
    string avatar
    string backgroundUrl
    date dateOfBirth
    string gender
    string googleId UK_sparse
    boolean twoFactorEnabled
    string twoFactorSecret
    boolean verified
    string role
    boolean isActive
    boolean isBlocked
    boolean onlineStatus
    int followersCount
    int followingCount
    int postsCount
    date lastLogin
    date createdAt
    date updatedAt
  }

  UserProfile {
    ObjectId _id PK
    ObjectId userId FK "UK"
    Map topicScores
    Map hashtagScores
    Map authorScores
    int interactionCount
    number avgSessionDuration
    string preferredContentType
    date lastCalculatedAt
    date updatedAt
  }

  Post {
    ObjectId _id PK
    ObjectId userId FK
    string contentText
    string visibility
    int likesCount
    int commentsCount
    int sharesCount
    int savesCount
    int viewsCount
    string moderationStatus
    number aiToxicScore
    number aiHateSpeechScore
    number aiSpamScore
    number aiOverallRisk
    boolean isHidden
    string hiddenReason
    boolean isEdited
    array_string topics
    number hotScore
    date hotScoreUpdatedAt
    number engagementRate
    string locationName
    number locationLatitude
    number locationLongitude
    date createdAt
    date updatedAt
  }

  PostMedia {
    ObjectId _id PK
    ObjectId postId FK
    ObjectId userId FK
    string mediaType
    string mediaUrl
    string thumbnailUrl
    string caption
    number width
    number height
    number duration
    number fileSize
    int orderIndex
    int likesCount
    int commentsCount
    int sharesCount
    date createdAt
    date updatedAt
  }

  PostHashtag {
    ObjectId _id PK
    ObjectId postId FK
    string hashtag
    date createdAt
  }

  PostMention {
    ObjectId _id PK
    ObjectId postId FK
    ObjectId mentionedUserId FK
    date createdAt
  }

  Comment {
    ObjectId _id PK
    ObjectId postId FK_nullable
    ObjectId mediaId FK_nullable
    ObjectId userId FK
    ObjectId parentCommentId FK_nullable
    ObjectId originalCommentId FK_nullable
    string contentText
    string moderationStatus
    boolean isHidden
    int likesCount
    int repliesCount
    boolean isEdited
    date createdAt
    date updatedAt
  }

  Like {
    ObjectId _id PK
    ObjectId userId FK
    ObjectId postId FK_nullable
    ObjectId commentId FK_nullable
    ObjectId mediaId FK_nullable
    date createdAt
  }

  Share {
    ObjectId _id PK
    ObjectId userId FK
    ObjectId postId FK_nullable
    ObjectId mediaId FK_nullable
    string caption
    date createdAt
  }

  Follow {
    ObjectId _id PK
    ObjectId followerId FK
    ObjectId followingId FK
    string followStatus
    string closeFriendStatus
    ObjectId closeFriendRequestedBy FK_nullable
    date closeFriendRequestedAt
    date createdAt
    date updatedAt
  }

  Block {
    ObjectId _id PK
    ObjectId blockerId FK
    ObjectId blockedId FK
    string reason
    date createdAt
  }

  Notification {
    ObjectId _id PK
    ObjectId userId FK
    ObjectId actorId FK
    string notificationType
    string entityType
    ObjectId entityId
    ObjectId postId FK_nullable
    ObjectId mediaId FK_nullable
    ObjectId commentId FK_nullable
    string content
    string thumbnailUrl
    boolean isRead
    boolean isSeen
    date createdAt
  }

  UserInteraction {
    ObjectId _id PK
    ObjectId userId FK
    ObjectId postId FK
    boolean viewed
    boolean liked
    boolean commented
    boolean shared
    boolean saved
    number weight
    string feedbackType
    number viewDuration
    number scrollDepth
    string source
    string deviceType
    date createdAt
  }

  RefreshToken {
    ObjectId _id PK
    ObjectId userId FK
    string tokenHash UK
    string family
    boolean isUsed
    boolean isRevoked
    date expiresAt
    date createdAt
    date updatedAt
  }

  User ||--o| UserProfile : has
  User ||--o{ Post : creates
  User ||--o{ PostMedia : uploads
  Post ||--o{ PostMedia : contains
  Post ||--o{ PostHashtag : tagged_with
  Post ||--o{ PostMention : mentions
  User ||--o{ PostMention : is_mentioned

  User ||--o{ Comment : writes
  Post ||--o{ Comment : receives
  PostMedia ||--o{ Comment : receives
  Comment ||--o{ Comment : replies_to
  Comment ||--o{ Comment : thread_root

  User ||--o{ Like : gives
  Post ||--o{ Like : post_like
  Comment ||--o{ Like : comment_like
  PostMedia ||--o{ Like : media_like

  User ||--o{ Share : shares
  Post ||--o{ Share : shared_post
  PostMedia ||--o{ Share : shared_media

  User ||--o{ Follow : follower
  User ||--o{ Follow : following
  User ||--o{ Follow : close_friend_requester

  User ||--o{ Block : blocker
  User ||--o{ Block : blocked

  User ||--o{ Notification : receives
  User ||--o{ Notification : acts
  Post ||--o{ Notification : related_post
  PostMedia ||--o{ Notification : related_media
  Comment ||--o{ Notification : related_comment

  User ||--o{ UserInteraction : performs
  Post ||--o{ UserInteraction : tracked_on

  User ||--o{ RefreshToken : owns
```

---

## Bảng mô tả nhanh

| Collection          | Mục đích                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| **User**            | Tài khoản, profile cơ bản, denormalized counts (followers, following, posts).                                |
| **UserProfile**     | Cache sở thích cho Personalized Feed: topicScores, hashtagScores, authorScores; cập nhật từ UserInteraction. |
| **Post**            | Bài viết; có topics, hotScore, engagementRate cho feed ranking.                                              |
| **PostMedia**       | Ảnh/video của post; mỗi media có like/comment/share riêng.                                                   |
| **PostHashtag**     | Hashtag của post (collection riêng, Post không có field hashtags).                                           |
| **PostMention**     | User được mention trong post.                                                                                |
| **Comment**         | Comment cho Post hoặc PostMedia; tự tham chiếu (parent/original) cho thread.                                 |
| **Like**            | Like đa hình: Post, Comment, PostMedia (một collection, partial unique index).                               |
| **Share**           | Share đa hình: Post hoặc PostMedia.                                                                          |
| **Follow**          | Quan hệ follow + trạng thái bạn thân (followStatus, closeFriendStatus).                                      |
| **Block**           | User chặn user.                                                                                              |
| **Notification**    | Thông báo cho user; entityType/entityId + postId/mediaId/commentId.                                          |
| **UserInteraction** | Tracking hành vi theo post (view, like, comment, share, save); weight cộng dồn; TTL 90 ngày.                 |
| **RefreshToken**    | Refresh token JWT; TTL theo expiresAt.                                                                       |

---

## Ghi chú quan trọng

### 1. Comment

- **postId** và **mediaId** optional: comment thuộc post hoặc media.
- **parentCommentId**: comment cha trực tiếp (reply).
- **originalCommentId**: comment gốc cấp 1 của thread (để gom replies).

### 2. Like (đa hình)

- Một collection cho like post, comment, media.
- Partial unique index: `(userId, postId)`, `(userId, commentId)`, `(userId, mediaId)` — chỉ áp dụng khi field tương ứng tồn tại, tránh duplicate key khi giá trị null.

### 3. CommentLike đã xóa

- Trước đây có collection CommentLike riêng; đã gộp vào **Like** với `commentId`. Mọi like comment dùng `LikeModel`.

### 4. UserInteraction

- Mỗi cặp **(userId, postId)** một document (unique index).
- **weight** cộng dồn bằng `$inc` (like + comment + …).
- Không còn field **type**; dùng các boolean **viewed, liked, commented, shared, saved**.
- **feedbackType**: organic | hide | not_interested | see_more | report (feedback âm).
- TTL 90 ngày trên **createdAt**.

### 5. UserProfile

- Một document per user (userId unique).
- **topicScores, hashtagScores, authorScores**: Map&lt;string, number&gt; — cập nhật từ InteractionTracker khi track (post.topics, PostHashtag, post.userId).
- **interactionCount** để phát hiện cold start (&lt; 10).

### 6. Post

- **topics**: array string (NLP hoặc rule từ content).
- **hotScore**: cache cho feed, cập nhật bởi cron (ví dụ mỗi 30 phút).
- **engagementRate**: (likes + comments + shares) / views.

### 7. Notification

- **userId**: người nhận; **actorId**: người gây ra hành động.
- **entityType** / **entityId** + **postId**, **mediaId**, **commentId** cho ngữ cảnh.

### 8. RefreshToken

- TTL index trên **expiresAt** → token hết hạn tự xóa.

### 9. File models khác

- **culture-translation.model.ts**, **trending-hashtag.model.ts**, **user-reference.model.ts** hiện đang chứa nội dung trùng/giống user-interaction; không tạo collection riêng trong ERD. Cần dọn hoặc tách schema đúng nếu dùng.

---

## Source models

| File                                                                 | Collection      |
| -------------------------------------------------------------------- | --------------- |
| [user.model.ts](../src/models/user.model.ts)                         | User            |
| [user-profile.model.ts](../src/models/user-profile.model.ts)         | UserProfile     |
| [post.model.ts](../src/models/post.model.ts)                         | Post            |
| [post-media.model.ts](../src/models/post-media.model.ts)             | PostMedia       |
| [post-hashtag.model.ts](../src/models/post-hashtag.model.ts)         | PostHashtag     |
| [post-mention.model.ts](../src/models/post-mention.model.ts)         | PostMention     |
| [comment.model.ts](../src/models/comment.model.ts)                   | Comment         |
| [like.model.ts](../src/models/like.model.ts)                         | Like            |
| [share.model.ts](../src/models/share.model.ts)                       | Share           |
| [follow.model.ts](../src/models/follow.model.ts)                     | Follow          |
| [block.model.ts](../src/models/block.model.ts)                       | Block           |
| [notification.model.ts](../src/models/notification.model.ts)         | Notification    |
| [user-interaction.model.ts](../src/models/user-interaction.model.ts) | UserInteraction |
| [refresh-token.model.ts](../src/models/refresh-token.model.ts)       | RefreshToken    |
