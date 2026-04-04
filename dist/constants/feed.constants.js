"use strict";
// src/constants/feed.constants.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOT_SCORE_BATCH_SIZE = exports.HOT_SCORE_CRON_INTERVAL_MINUTES = exports.EXPLORATION_RATE = exports.POPULARITY_GRAVITY = exports.MAX_POST_AGE_DAYS = exports.CANDIDATE_POOL_SIZE = exports.COLD_START_THRESHOLD = exports.SCORE_WEIGHTS = void 0;
exports.SCORE_WEIGHTS = {
    // User mới < 10 interactions — chưa đủ data profile
    cold_start: {
        content: 0.05,
        popularity: 0.7,
        social: 0.25,
    },
    // User bình thường — tin vào profile sở thích
    normal: {
        content: 0.5,
        popularity: 0.2,
        social: 0.3,
    },
};
exports.COLD_START_THRESHOLD = 10;
exports.CANDIDATE_POOL_SIZE = 200;
exports.MAX_POST_AGE_DAYS = 7;
exports.POPULARITY_GRAVITY = 1.5;
exports.EXPLORATION_RATE = 0.15; // 15% bài ngẫu nhiên ngoài vùng sở thích
/** Cron cập nhật hotScore: chạy mỗi 30 phút */
exports.HOT_SCORE_CRON_INTERVAL_MINUTES = 30;
exports.HOT_SCORE_BATCH_SIZE = 500;
