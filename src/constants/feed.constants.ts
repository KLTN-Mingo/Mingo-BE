// src/constants/feed.constants.ts

export const SCORE_WEIGHTS = {
  // User mới < 10 interactions
  cold_start: {
    content: 0.05,
    popularity: 0.7,
    social: 0.25,
  },
  // User bình thường
  normal: {
    content: 0.5,
    popularity: 0.2,
    social: 0.3,
  },
};

export const COLD_START_THRESHOLD = 10;
export const CANDIDATE_POOL_SIZE = 200;
export const MAX_POST_AGE_DAYS = 7;
export const POPULARITY_GRAVITY = 1.5;
export const HOT_SCORE_MULTIPLIER = 2;
export const EXPLORATION_RATE = 0.15;
export const TOP_INTEREST_TOPIC_COUNT = 5;

export const HOT_SCORE_CRON_INTERVAL_MINUTES = 30;
export const HOT_SCORE_BATCH_SIZE = 500;
