export const FLIGHT_PHASES = {
  PAD: "pad",
  ASCENT: "ascent",
  ORBIT_PUSH: "orbit_push",
  ORBIT: "orbit",
  CRASHED: "crashed",
  ESCAPED: "escaped",
  NO_FUEL: "no_fuel",
};

const PHASE_LABELS = {
  [FLIGHT_PHASES.PAD]: "En la plataforma",
  [FLIGHT_PHASES.ASCENT]: "Ascenso",
  [FLIGHT_PHASES.ORBIT_PUSH]: "Inserción orbital",
  [FLIGHT_PHASES.ORBIT]: "En órbita",
  [FLIGHT_PHASES.CRASHED]: "Estrellado",
  [FLIGHT_PHASES.ESCAPED]: "Perdido en el espacio",
  [FLIGHT_PHASES.NO_FUEL]: "Sin combustible",
};

export function getPhaseLabel(phaseId) {
  return PHASE_LABELS[phaseId] || PHASE_LABELS[FLIGHT_PHASES.PAD];
}

export default class FlightPhaseController {
  update(state, dt, world) {
    if (state.result) {
      return state;
    }

    const altitude = state.altitude;
    const horizontalSpeed = Math.abs(state.horizontalVelocity);
    const verticalSpeed = state.verticalVelocity;

    if (state.launched && altitude <= 0 && state.time > 1) {
      const impactSpeed = Math.max(state.speed, Math.abs(verticalSpeed));
      const landingTilt = Math.abs((state.localOrientation * 180) / Math.PI + 90);

      if (
        impactSpeed > world.safeLandingSpeed ||
        horizontalSpeed > world.safeLandingHorizontalSpeed ||
        landingTilt > world.safeLandingAngle
      ) {
        return this.fail(
          state,
          FLIGHT_PHASES.CRASHED,
          "El cohete cayó antes de entrar en órbita. Sigue la flecha: sube recto y luego gira hacia la derecha.",
        );
      }

      Object.assign(state, {
        altitude: 0,
        downrange: 0,
        horizontalVelocity: 0,
        verticalVelocity: 0,
        localOrientation: -Math.PI / 2,
        angularVelocity: 0,
        launched: false,
        insertionStarted: false,
        orbitHoldTime: 0,
      });
      return this.setPhase(state, FLIGHT_PHASES.PAD);
    }

    state.pathAngle =
      (Math.atan2(Math.abs(verticalSpeed), Math.max(horizontalSpeed, 0.001)) * 180) / Math.PI;
    state.orbitWindow =
      altitude >= world.orbitMinAltitude &&
      altitude < world.earthEscapeAltitude - 40 &&
      horizontalSpeed >= world.orbitTargetHorizontalSpeed * world.orbitSpeedRatio &&
      state.pathAngle <= world.orbitMaxPathAngle;

    // Enough orbital speed and a shallow path that coasts into the orbit band:
    // the pilot can let go of the engine and glide the rest of the way.
    state.cutEngineCue =
      horizontalSpeed >= world.orbitTargetHorizontalSpeed &&
      state.pathAngle <= world.orbitMaxPathAngle &&
      (altitude >= world.orbitMinAltitude || verticalSpeed > 0);

    state.orbitHoldTime = state.orbitWindow
      ? state.orbitHoldTime + dt
      : Math.max(0, state.orbitHoldTime - dt * 2);

    if (state.orbitHoldTime >= world.orbitLockDuration) {
      state.orbitAchieved = true;
      state.result = "success";
      state.reason = "¡Órbita estable! El cohete ya no cae: gira alrededor del planeta.";
      return this.setPhase(state, FLIGHT_PHASES.ORBIT);
    }

    if (altitude >= world.earthEscapeAltitude) {
      return this.fail(
        state,
        FLIGHT_PHASES.ESCAPED,
        "Subiste demasiado y el cohete se perdió en el espacio. Gira antes para ganar velocidad lateral en vez de altura.",
      );
    }

    if (state.launched && state.fuelRemaining <= 0.01 && !state.orbitWindow) {
      state.outOfFuelTime += dt;
      if (state.outOfFuelTime > world.outOfFuelGraceTime && verticalSpeed < 0) {
        return this.fail(
          state,
          FLIGHT_PHASES.NO_FUEL,
          "Se acabó el combustible antes de alcanzar la velocidad orbital. Añade tanques o vuela más directo.",
        );
      }
    } else {
      state.outOfFuelTime = 0;
    }

    if (state.time >= world.missionTimeout) {
      return this.fail(state, FLIGHT_PHASES.NO_FUEL, "Se acabó el tiempo de la misión.");
    }

    if (!state.launched) {
      return this.setPhase(state, FLIGHT_PHASES.PAD);
    }

    return this.setPhase(
      state,
      altitude < world.atmosphereHeight && !state.insertionStarted
        ? FLIGHT_PHASES.ASCENT
        : FLIGHT_PHASES.ORBIT_PUSH,
    );
  }

  setPhase(state, phaseId) {
    state.phaseId = phaseId;
    state.phase = getPhaseLabel(phaseId);
    return state;
  }

  fail(state, phaseId, reason) {
    state.result = "failure";
    state.failure = phaseId;
    state.reason = reason;
    return this.setPhase(state, phaseId);
  }
}
