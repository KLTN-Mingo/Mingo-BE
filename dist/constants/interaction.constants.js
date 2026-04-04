"use strict";
// src/constants/interaction.constants.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLD_START_THRESHOLD = exports.MIN_VIEW_DURATION_SECONDS = exports.INTERACTION_DECAY = exports.INTERACTION_WEIGHTS = void 0;
exports.INTERACTION_WEIGHTS = {
    view: 1,
    like: 3,
    comment: 4,
    share: 5,
    save: 4,
    follow_from_post: 6,
    hide: -5,
    not_interested: -3,
    see_more: 2,
};
exports.INTERACTION_DECAY = {
    view: 0.6,
    like: 1.0,
    comment: 1.0,
    share: 1.0,
    save: 1.0,
    follow_from_post: 1.2,
    hide: -1.0,
    not_interested: -1.0,
    see_more: 0.8,
};
exports.MIN_VIEW_DURATION_SECONDS = 2;
exports.COLD_START_THRESHOLD = 10;
