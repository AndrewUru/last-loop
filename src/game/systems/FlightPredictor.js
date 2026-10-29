import FlightSimulator from "./FlightSimulator.js";

const STEP_MS = 1000 / 30;
const MAX_STEPS = 30 * 300;

// Flies the rocket with a perfect pilot that follows the guidance arrow and
// lets go of the engine when told. The hangar uses it to say whether a design
// can reach orbit at all; a human pilot will usually do a bit worse.
export default class FlightPredictor {
  static predict(stats) {
    const simulator = new FlightSimulator(stats);
    let state = simulator.state;
    let maxAltitude = 0;

    for (let step = 0; step < MAX_STEPS && !state.result; step += 1) {
      const coast = state.cutEngineCue;
      state = simulator.update(STEP_MS, {
        engineOn: !coast,
        throttle: coast ? 0 : 1,
        steer: Math.max(-1, Math.min(1, state.guidanceError * 4)),
      });
      maxAltitude = Math.max(maxAltitude, state.altitude);

      if (!state.launched && state.time > 3) {
        break;
      }
    }

    return {
      success: state.result === "success",
      lifted: state.launched || maxAltitude > 0,
      failure: state.failure,
      time: state.time,
      maxAltitude,
      fuelPercent: stats.fuel > 0 ? Math.round((state.fuelRemaining / stats.fuel) * 100) : 0,
    };
  }
}
