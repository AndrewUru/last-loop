import FlightSimulator from "./FlightSimulator.js";

const STEP_MS = 1000 / 30;
const MAX_STEPS = 30 * 300;
// tracePath keeps one sample every half second.
const TRACE_EVERY = 15;

// Flies the rocket with a perfect pilot that follows the guidance arrow and
// lets go of the engine when told, calling onStep after every step. Stops
// early if the rocket never leaves the pad or onStep returns true.
function flyPerfectly(stats, onStep) {
  const simulator = new FlightSimulator(stats);
  let state = simulator.state;

  for (let step = 0; step < MAX_STEPS && !state.result; step += 1) {
    const coast = state.cutEngineCue;
    state = simulator.update(STEP_MS, {
      engineOn: !coast,
      throttle: coast ? 0 : 1,
      steer: Math.max(-1, Math.min(1, state.guidanceError * 4)),
    });

    if (onStep(state, step) || (!state.launched && state.time > 3)) {
      break;
    }
  }
  return state;
}

// The hangar uses the perfect flight as a reference for each rocket; a human
// pilot will usually do a bit worse.
export default class FlightPredictor {
  static predict(stats) {
    let maxAltitude = 0;
    const state = flyPerfectly(stats, (current) => {
      maxAltitude = Math.max(maxAltitude, current.altitude);
    });

    return {
      success: state.result === "success",
      lifted: state.launched || maxAltitude > 0,
      failure: state.failure,
      time: state.time,
      maxAltitude,
      fuelPercent: stats.fuel > 0 ? Math.round((state.fuelRemaining / stats.fuel) * 100) : 0,
    };
  }

  // Where the perfect climb goes while the engines burn: physics positions of
  // the rocket's base with its altitude and heading. Missions place rings,
  // parts and debris along it.
  static tracePath(stats) {
    const samples = [];
    flyPerfectly(stats, (state, step) => {
      if (state.launched && step % TRACE_EVERY === 0) {
        samples.push({ altitude: state.altitude, position: { ...state.position }, orientation: state.orientation });
      }
      return state.cutEngineCue;
    });
    return samples;
  }
}
