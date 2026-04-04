"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runHotScoreUpdate = runHotScoreUpdate;
exports.startHotScoreCron = startHotScoreCron;
exports.stopHotScoreCron = stopHotScoreCron;
// src/services/hot-score-cron.service.ts
const post_model_1 = require("../models/post.model");
const hot_score_util_1 = require("../utils/hot-score.util");
const feed_constants_1 = require("../constants/feed.constants");
let isRunning = false;
let intervalId = null;
async function runHotScoreUpdate() {
    if (isRunning) {
        console.log("[HotScoreCron] Bỏ qua: job trước vẫn đang chạy.");
        return { updated: 0, batches: 0 };
    }
    isRunning = true;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - feed_constants_1.MAX_POST_AGE_DAYS);
    let totalUpdated = 0;
    let batchCount = 0;
    try {
        let skip = 0;
        let hasMore = true;
        while (hasMore) {
            const posts = await post_model_1.PostModel.find({
                isHidden: false,
                moderationStatus: post_model_1.ModerationStatus.APPROVED,
                createdAt: { $gte: cutoff },
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(feed_constants_1.HOT_SCORE_BATCH_SIZE)
                .lean();
            if (posts.length === 0)
                break;
            const ops = posts.map((post) => {
                const score = (0, hot_score_util_1.calculateHotScore)(post);
                const now = new Date();
                return {
                    updateOne: {
                        filter: { _id: post._id },
                        update: { $set: { hotScore: score, hotScoreUpdatedAt: now } },
                    },
                };
            });
            await post_model_1.PostModel.bulkWrite(ops);
            totalUpdated += posts.length;
            batchCount += 1;
            skip += feed_constants_1.HOT_SCORE_BATCH_SIZE;
            hasMore = posts.length === feed_constants_1.HOT_SCORE_BATCH_SIZE;
        }
        if (totalUpdated > 0) {
            console.log(`[HotScoreCron] Đã cập nhật hotScore cho ${totalUpdated} bài (${batchCount} batch).`);
        }
    }
    catch (err) {
        console.error("[HotScoreCron] Lỗi:", err);
    }
    finally {
        isRunning = false;
    }
    return { updated: totalUpdated, batches: batchCount };
}
function startHotScoreCron() {
    if (intervalId)
        return;
    const ms = feed_constants_1.HOT_SCORE_CRON_INTERVAL_MINUTES * 60 * 1000;
    runHotScoreUpdate().then(() => {
        intervalId = setInterval(() => runHotScoreUpdate(), ms);
        console.log(`[HotScoreCron] Đã lên lịch chạy mỗi ${feed_constants_1.HOT_SCORE_CRON_INTERVAL_MINUTES} phút.`);
    });
}
function stopHotScoreCron() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log("[HotScoreCron] Đã dừng.");
    }
}
