import FlightSimulator from "./FlightSimulator.js";

const STEP_MS = 1000 / 30;
const MAX_STEPS = 30 * 600;
// tracePath keeps one sample every half second.
const TRACE_EVERY = 15;

// Fuel left at the end, as a share of the rocket's total: only the stages
// still attached count, so dropping a stage with fuel in it costs points.
export function getFuelPercent(state, stats) {
  const left = state.totalFuel ?? state.fuelRemaining;
  return stats.fuel > 0 ? Math.round((left / stats.fuel) * 100) : 0;
}

// Flies the rocket with a perfect pilot that follows the guidance arrow, lets
// go of the engine when told and drops each stage as soon as it runs dry,
// calling onStep after every step. Stops early if the rocket never leaves the
// pad or onStep returns true.
function flyPerfectly(stats, options, onStep) {
  const simulator = new FlightSimulator(stats, options);
  let state = simulator.state;

  for (let step = 0; step < MAX_STEPS && !state.result; step += 1) {
    // After orbit the pilot first turns to the arrow, then burns.
    const aligned = state.missionPhase === 0 || Math.abs(state.guidanceError) < 0.2;
    const coast = state.cutEngineCue || !aligned;
    state = simulator.update(STEP_MS, {
      engineOn: !coast,
      throttle: coast ? 0 : 1,
      steer: Math.max(-1, Math.min(1, state.guidanceError * 4)),
      separate: state.separationCue,
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
  // options: the rocket's stages and mission phases (getFlightOptions).
  static predict(stats, options = {}) {
    let maxAltitude = 0;
    const phaseTimes = [];
    const state = flyPerfectly(stats, options, (current) => {
      maxAltitude = Math.max(maxAltitude, current.altitude);
      if (current.missionPhase > phaseTimes.length) {
        phaseTimes.push(current.time);
      }
    });

    return {
      success: state.result === "success",
      lifted: state.launched || maxAltitude > 0,
      failure: state.failure,
      reason: state.reason,
      time: state.time,
      phaseTimes,
      maxAltitude,
      separations: state.separations,
      fuelPercent: getFuelPercent(state, stats),
    };
  }

  // Trace the whole ascent, including the coast from engine cutoff to orbit.
  // Stopping at cutoff squeezes fast rockets' targets into the launch area.
  static tracePath(stats, options = {}) {
    const samples = [];
    flyPerfectly(stats, options, (state, step) => {
      const reachedOrbit = state.missionPhase > 0 || state.orbitAchieved;
      if (state.launched && (step % TRACE_EVERY === 0 || reachedOrbit)) {
        samples.push({ altitude: state.altitude, position: { ...state.position }, orientation: state.orientation });
      }
      return reachedOrbit;
    });
    return samples;
  }
}
