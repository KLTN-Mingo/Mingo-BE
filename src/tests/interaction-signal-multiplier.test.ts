import {
  INTERACTION_SIGNAL_MULTIPLIERS,
  INTERACTION_WEIGHTS,
} from "../constants/interaction.constants";
import { PROFILE_SCORE_DAILY_RETENTION } from "../utils/profile-score.util";

if (INTERACTION_WEIGHTS.view !== 1) {
  throw new Error("View interaction weight changed unexpectedly");
}
if (INTERACTION_SIGNAL_MULTIPLIERS.view !== 0.6) {
  throw new Error("View signal multiplier changed unexpectedly");
}
if (PROFILE_SCORE_DAILY_RETENTION !== 0.98) {
  throw new Error("Profile time-decay retention must remain independent");
}
if (
  Number(INTERACTION_SIGNAL_MULTIPLIERS.view) ===
  Number(PROFILE_SCORE_DAILY_RETENTION)
) {
  throw new Error("Signal multiplier must not be reused as time decay");
}

console.log("interaction signal multiplier test passed");
