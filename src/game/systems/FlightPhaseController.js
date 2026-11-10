export const FLIGHT_PHASES = {
  PAD: "pad",
  ASCENT: "ascent",
  ORBIT_PUSH: "orbit_push",
  ORBIT: "orbit",
  RAISE: "raise",
  ESCAPE_BURN: "escape_burn",
  REENTRY: "reentry",
  CRASHED: "crashed",
  ESCAPED: "escaped",
  NO_FUEL: "no_fuel",
};

const PHASE_LABELS = {
  [FLIGHT_PHASES.PAD]: "En la plataforma",
  [FLIGHT_PHASES.ASCENT]: "Ascenso",
  [FLIGHT_PHASES.ORBIT_PUSH]: "Inserción orbital",
  [FLIGHT_PHASES.ORBIT]: "En órbita",
  [FLIGHT_PHASES.RAISE]: "Hacia la órbita alta",
  [FLIGHT_PHASES.ESCAPE_BURN]: "Inyección lunar",
  [FLIGHT_PHASES.REENTRY]: "Reentrada",
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
          state.peakAltitude >= world.reentryMinPeak
            ? "La reentrada fue demasiado rápida. Enciende el motor apuntando hacia arriba para frenar antes del suelo."
            : "El cohete cayó antes de entrar en órbita. Sigue la flecha: sube recto y luego gira hacia la derecha.",
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
        peakAltitude: 0,
        reentryHeat: 0,
      });
      return this.setPhase(state, FLIGHT_PHASES.PAD);
    }

    state.pathAngle =
      (Math.atan2(Math.abs(verticalSpeed), Math.max(horizontalSpeed, 0.001)) * 180) / Math.PI;
    const phases = state.missionPhases || [{ type: "orbit" }];
    const goal = phases[state.missionPhase] || phases[0];
    const lastPhase = state.missionPhase >= phases.length - 1;

    // orbitWindow: the current phase's goal is met right now; holding it for
    // a moment locks the phase. cutEngineCue: the engine can rest.
    if (goal.type === "orbit") {
      state.orbitWindow =
        altitude >= world.orbitMinAltitude &&
        altitude < world.earthEscapeAltitude - 40 &&
        horizontalSpeed >= world.orbitTargetHorizontalSpeed * world.orbitSpeedRatio &&
        state.pathAngle <= world.orbitMaxPathAngle;
      // Enough orbital speed and a shallow path that coasts into the orbit
      // band: the pilot can let go of the engine and glide the rest of the way.
      state.cutEngineCue =
        horizontalSpeed >= world.orbitTargetHorizontalSpeed &&
        state.pathAngle <= world.orbitMaxPathAngle &&
        (altitude >= world.orbitMinAltitude || verticalSpeed > 0);
    } else if (goal.type === "raise") {
      state.orbitWindow =
        Math.abs(altitude - goal.altitude) <= world.raiseTolerance &&
        Math.abs(verticalSpeed) <= world.raiseMaxClimb &&
        horizontalSpeed >= world.orbitTargetHorizontalSpeed * world.orbitSpeedRatio;
      state.cutEngineCue = state.phaseCoast;
    } else {
      state.orbitWindow = horizontalSpeed >= goal.speed;
      state.cutEngineCue = state.phaseCoast;
    }

    state.orbitHoldTime = state.orbitWindow
      ? state.orbitHoldTime + dt
      : Math.max(0, state.orbitHoldTime - dt * 2);

    if (state.orbitHoldTime >= world.orbitLockDuration) {
      if (!lastPhase) {
        // On to the next phase of the mission.
        state.missionPhase += 1;
        state.orbitHoldTime = 0;
        state.outOfFuelTime = 0;
        state.phaseAdvancedAt = state.time;
        return this.setPhase(state, this.getFlightPhaseFor(phases[state.missionPhase]));
      }
      return this.succeed(state, goal);
    }

    if (altitude >= world.earthEscapeAltitude) {
      if (goal.type === "escape") {
        return this.succeed(state, goal);
      }
      return this.fail(
        state,
        FLIGHT_PHASES.ESCAPED,
        "Subiste demasiado y el cohete se perdió en el espacio. Gira antes para ganar velocidad lateral en vez de altura.",
      );
    }

    // Out of fuel means every attached stage is dry; an empty stage with a
    // full one above it only needs separating.
    const fuelLeft = state.totalFuel ?? state.fuelRemaining;
    if (state.launched && fuelLeft <= 0.01 && !state.orbitWindow) {
      state.outOfFuelTime += dt;
      const inOrbit = state.missionPhase > 0;
      if (state.outOfFuelTime > world.outOfFuelGraceTime && (inOrbit || verticalSpeed < 0)) {
        return this.fail(
          state,
          FLIGHT_PHASES.NO_FUEL,
          inOrbit
            ? "Te quedaste sin combustible antes de terminar la misión. Separa las etapas a tiempo y no gastes de más."
            : "Se acabó el combustible antes de alcanzar la velocidad orbital. Separa cada etapa en cuanto se vacíe.",
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

    if (
      altitude < world.atmosphereHeight &&
      verticalSpeed < 0 &&
      state.peakAltitude >= world.reentryMinPeak
    ) {
      return this.setPhase(state, FLIGHT_PHASES.REENTRY);
    }

    if (state.missionPhase > 0) {
      return this.setPhase(state, this.getFlightPhaseFor(goal));
    }

    return this.setPhase(
      state,
      altitude < world.atmosphereHeight && !state.insertionStarted
        ? FLIGHT_PHASES.ASCENT
        : FLIGHT_PHASES.ORBIT_PUSH,
    );
  }

  getFlightPhaseFor(goal) {
    return goal.type === "raise" ? FLIGHT_PHASES.RAISE : goal.type === "escape" ? FLIGHT_PHASES.ESCAPE_BURN : FLIGHT_PHASES.ORBIT_PUSH;
  }

  succeed(state, goal) {
    state.orbitAchieved = true;
    state.result = "success";
    if (goal.type === "raise") {
      state.finalOrbitAltitude = goal.altitude;
      state.reason = `¡Órbita alta alcanzada a ${goal.altitude} km! Misión completada.`;
    } else if (goal.type === "escape") {
      state.escaping = true;
      state.reason = "¡Rumbo a la Luna! La última etapa te ha lanzado fuera de la órbita.";
    } else {
      state.reason = "¡Órbita estable! El cohete ya no cae: gira alrededor del planeta.";
    }
    return this.setPhase(state, FLIGHT_PHASES.ORBIT);
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
