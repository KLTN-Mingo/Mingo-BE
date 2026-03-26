"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateHotScore = calculateHotScore;
const feed_constants_1 = require("../constants/feed.constants");
function calculateHotScore(post) {
    const engagements = (post.likesCount ?? 0) * 3 +
        (post.commentsCount ?? 0) * 4 +
        (post.sharesCount ?? 0) * 5 +
        (post.savesCount ?? 0) * 4 +
        (post.viewsCount ?? 0) * 0.1;
    const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / 3600000;
    const raw = engagements / Math.pow(ageHours + 2, feed_constants_1.POPULARITY_GRAVITY);
    return Math.round(raw * 100) / 100;
}
