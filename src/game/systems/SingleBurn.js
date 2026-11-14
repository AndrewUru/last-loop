// The single-burn rule: during the climb to orbit each stage lights once.
// Letting go of the engine while a stage is burning locks it until that stage
// is dropped. What does not count as a burn:
//   - letting go on the pad, before the clamps release
//   - a stage that has not been lit yet: after a separation the pilot may
//     take a moment to press thrust again, and the new stage waits for it
//   - an empty stage (there is nothing left to relight)
// After orbit the engine is free again.
//
// rule: { engineLocked, lockedStage, ignitedStage }, kept for the whole flight.
// Returns the thrust the engine actually gets.
export function createSingleBurnRule() {
  return { engineLocked: false, lockedStage: null, ignitedStage: null };
}

export function applySingleBurn(rule, state, thrust) {
  if (state.missionPhase > 0) {
    rule.engineLocked = false;
    return thrust;
  }
  if (rule.engineLocked && state.stage !== rule.lockedStage) {
    rule.engineLocked = false;
  }
  if (state.launched && state.fuelRemaining > 0.01 && !rule.engineLocked) {
    if (thrust) {
      rule.ignitedStage = state.stage;
    } else if (rule.ignitedStage === state.stage) {
      rule.engineLocked = true;
      rule.lockedStage = state.stage;
    }
  }
  return rule.engineLocked ? false : thrust;
}
