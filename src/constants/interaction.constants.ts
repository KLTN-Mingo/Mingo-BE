// src/constants/interaction.constants.ts

export const INTERACTION_WEIGHTS: Record<string, number> = {
    view:            1,
    like:            3,
    comment:         4,
    share:           5,
    save:            4,
    follow_from_post: 6,
    hide:           -5,
    not_interested: -3,
    see_more:        2,
  };
  
  export const INTERACTION_DECAY: Record<string, number> = {
    view:            0.6,  
    like:            1.0,
    comment:         1.0,
    share:           1.0,
    save:            1.0,
    follow_from_post: 1.2,
    hide:           -1.0,
    not_interested: -1.0,
    see_more:        0.8,
  };
  
  export const MIN_VIEW_DURATION_SECONDS = 2;
  
  export const COLD_START_THRESHOLD = 10;