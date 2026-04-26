function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function radToDeg(radians) {
  return (radians * 180) / Math.PI;
}

export const FLIGHT_PHASES = {
  PAD: "pad",
  LIFTOFF: "liftoff",
  ASCENT: "ascent",
  GRAVITY_TURN: "turn",
  ORBIT_PUSH: "orbit_push",
  ORBIT: "orbit",
  CRASHED: "crashed",
  ESCAPED: "escaped",
};

const PHASE_META = {
  [FLIGHT_PHASES.PAD]: {
    id: "launch",
    index: 1,
    total: 5,
    label: "Phase 1: Launch",
    title: "Phase 1/5: Launch",
    message:
      "Ignite cleanly, leave the tower, and keep the stack upright until it clears the pad.",
    status: "Commit to liftoff before you start steering.",
  },
  [FLIGHT_PHASES.LIFTOFF]: {
    id: "launch",
    index: 1,
    total: 5,
    label: "Phase 1: Liftoff",
    title: "Phase 1/5: Liftoff",
    message:
      "Build a safe initial climb. Small corrections are enough while the rocket is still close to the pad.",
    status: "Climb first and avoid wasting control authority low in the atmosphere.",
  },
  [FLIGHT_PHASES.ASCENT]: {
    id: "ascent",
    index: 2,
    total: 5,
    label: "Phase 2: Ascent",
    title: "Phase 2/5: Atmospheric Ascent",
    message:
      "Keep rising through the dense air. Save the stronger pitch-over for later when drag falls away.",
    status: "Prioritize altitude while the atmosphere is still heavy.",
  },
  [FLIGHT_PHASES.GRAVITY_TURN]: {
    id: "gravity-turn",
    index: 3,
    total: 5,
    label: "Phase 3: Gravity Turn",
    title: "Phase 3/5: Gravity Turn",
    message:
      "Start leaning into the turn. Trade some vertical climb for steady sideways speed without dropping too low.",
    status: "Pitch gradually and keep vertical speed under control.",
  },
  [FLIGHT_PHASES.ORBIT_PUSH]: {
    id: "orbit-push",
    index: 4,
    total: 5,
    label: "Phase 4: Orbit Push",
    title: "Phase 4/5: Orbit Push",
    message:
      "You are above the worst drag. Flatten out and build horizontal speed instead of climbing straight up.",
    status: "Chase lateral velocity and keep the climb shallow.",
  },
  [FLIGHT_PHASES.ORBIT]: {
    id: "hold-orbit",
    index: 5,
    total: 5,
    label: "Phase 5: Hold Orbit",
    title: "Phase 5/5: Hold Orbit",
    message:
      "Hold the corridor a little longer. Keep vertical speed low until the orbit lock completes.",
    status: "Stay nearly level and avoid big throttle spikes.",
  },
  [FLIGHT_PHASES.CRASHED]: {
    id: "failed",
    index: 5,
    total: 5,
    label: "Mission Lost",
    title: "Mission Lost",
    message: "The vehicle was lost before it could stabilize in orbit.",
    status: "Rebuild or fly a cleaner profile next attempt.",
  },
  [FLIGHT_PHASES.ESCAPED]: {
    id: "escaped",
    index: 5,
    total: 5,
    label: "Mission Lost",
    title: "Mission Lost",
    message: "The ship overshot the orbital window instead of settling into a stable orbit.",
    status: "Aim for control, not just height.",
  },
};

export function getPhaseLabel(phaseId) {
  switch (phaseId) {
    case FLIGHT_PHASES.LIFTOFF:
      return "Liftoff";
    case FLIGHT_PHASES.ASCENT:
      return "Atmospheric Ascent";
    case FLIGHT_PHASES.GRAVITY_TURN:
      return "Gravity Turn";
    case FLIGHT_PHASES.ORBIT_PUSH:
      return "Orbit Push";
    case FLIGHT_PHASES.ORBIT:
      return "Stable Orbit";
    case FLIGHT_PHASES.CRASHED:
      return "Crashed";
    case FLIGHT_PHASES.ESCAPED:
      return "Escaped";
    case FLIGHT_PHASES.PAD:
    default:
      return "Pad";
  }
}

export function getPhaseMeta(phaseId) {
  return PHASE_META[phaseId] || PHASE_META[FLIGHT_PHASES.PAD];
}

export default class FlightPhaseController {
  update(state, dt, world) {
    if (state.result) {
      return state;
    }

    const altitude = state.altitude;
    const horizontalSpeed = Math.abs(state.horizontalVelocity);
    const verticalSpeed = state.verticalVelocity;
    const pitchDegrees = radToDeg(state.localOrientation);
    const inOrbitWindow =
      altitude >= world.orbitMinAltitude &&
      altitude <= world.targetOrbitAltitude + 70 &&
      horizontalSpeed >= world.orbitTargetHorizontalSpeed * 0.92 &&
      Math.abs(verticalSpeed) <= world.orbitVerticalTolerance &&
      pitchDegrees >= world.orbitAngleMin &&
      pitchDegrees <= world.orbitAngleMax;

    if (inOrbitWindow) {
      state.orbitHoldTime += dt;
    } else {
      state.orbitHoldTime = Math.max(0, state.orbitHoldTime - dt * 0.7);
    }

    if ((state.launched || state.speed > 0.05) && state.altitude <= 0 && state.time > 1.2) {
      const impactSpeed = Math.max(state.speed, Math.abs(verticalSpeed));
      const landingTilt = Math.abs(pitchDegrees + 90);

      if (
        impactSpeed > world.safeLandingSpeed ||
        horizontalSpeed > world.safeLandingHorizontalSpeed ||
        landingTilt > world.safeLandingAngle
      ) {
        return this.fail(
          state,
          FLIGHT_PHASES.CRASHED,
          "The vehicle crashed back into the launch site.",
        );
      }

      state.altitude = 0;
      state.downrange = 0;
      state.horizontalVelocity = 0;
      state.verticalVelocity = 0;
      state.position.x = 0;
      state.position.y = -world.planetRadius;
      state.velocity.x = 0;
      state.velocity.y = 0;
      state.radius = world.planetRadius;
      state.speed = 0;
      state.radialVelocity = 0;
      state.tangentialVelocity = 0;
      state.localOrientation = -Math.PI / 2;
      state.orientation = -Math.PI / 2;
      state.angularVelocity = 0;
      state.launched = false;
      state.orbitHoldTime = 0;
      return this.setPhase(state, FLIGHT_PHASES.PAD);
    }

    if (state.orbitHoldTime >= world.orbitLockDuration) {
      state.orbitAchieved = true;
      state.result = "success";
      state.reason = "Stable orbit achieved. Mission complete.";
      return this.setPhase(state, FLIGHT_PHASES.ORBIT);
    }

    if (altitude >= world.earthEscapeAltitude) {
      return this.fail(
        state,
        FLIGHT_PHASES.ESCAPED,
        "The ship climbed past the orbital corridor before it could stabilize.",
      );
    }

    if (
      state.fuelRemaining <= 0.01 &&
      !state.orbitAchieved &&
      state.time > world.outOfFuelGraceTime &&
      altitude < world.orbitMinAltitude &&
      verticalSpeed < -world.outOfFuelFallSpeed
    ) {
      return this.fail(
        state,
        FLIGHT_PHASES.CRASHED,
        "Fuel depleted before the rocket could build a stable orbit.",
      );
    }

    if (state.time >= world.missionTimeout) {
      return this.fail(
        state,
        FLIGHT_PHASES.CRASHED,
        "Mission timed out before achieving a stable orbit.",
      );
    }

    let nextPhase = FLIGHT_PHASES.PAD;

    if (!state.launched) {
      nextPhase =
        state.engineOn && state.throttle > 0.02
          ? FLIGHT_PHASES.LIFTOFF
          : FLIGHT_PHASES.PAD;
    } else if (altitude < world.liftoffAltitude) {
      nextPhase = FLIGHT_PHASES.LIFTOFF;
    } else if (altitude < world.turnStartAltitude) {
      nextPhase = FLIGHT_PHASES.ASCENT;
    } else if (
      altitude < world.orbitMinAltitude ||
      horizontalSpeed < world.orbitTargetHorizontalSpeed * 0.72
    ) {
      nextPhase = FLIGHT_PHASES.GRAVITY_TURN;
    } else if (state.orbitHoldTime > 0.08 || state.orbitAchieved) {
      nextPhase = FLIGHT_PHASES.ORBIT;
    } else {
      nextPhase = FLIGHT_PHASES.ORBIT_PUSH;
    }

    state.escapeProgress = clamp(
      altitude / Math.max(world.earthEscapeAltitude, 1),
      0,
      1,
    );

    return this.setPhase(state, nextPhase);
  }

  setPhase(state, phaseId) {
    state.phaseId = phaseId;
    state.phase = getPhaseLabel(phaseId);
    return state;
  }

  fail(state, phaseId, reason) {
    state.result = "failure";
    state.reason = reason;
    return this.setPhase(state, phaseId);
  }
}
