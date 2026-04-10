import { FLIGHT_PHASES, getPhaseLabel } from "./FlightPhaseController.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function angleDifference(target, current) {
  let delta = target - current;

  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }

  return delta;
}

function length(vector) {
  return Math.hypot(vector.x, vector.y);
}

export const FLIGHT_WORLD = {
  planetRadius: 260,
  atmosphereHeight: 110,
  targetOrbitAltitude: 220,
  earthEscapeAltitude: 430,
  orbitLockDuration: 4,
  missionTimeout: 420,
  // Core jam tuning: lighter gravity, a touch more thrust, and a gentler
  // orbital target make the climb readable without turning the game into a toy.
  gravity: 0.098,
  thrustScale: 0.142,
  fuelBurnScale: 0.32,
  fuelMassFactor: 0.16,
  baseTurnAuthority: 4.6,
  angularDamping: 3.1,
  dragBase: 0.0078,
  dragWidthPenalty: 0.001,
  dragInstabilityPenalty: 0.0035,
  liftoffAltitude: 18,
  turnStartAltitude: 72,
  orbitMinAltitude: 170,
  orbitTargetHorizontalSpeed: 2.08,
  orbitVerticalTolerance: 0.28,
  orbitAngleMin: -35,
  orbitAngleMax: 14,
  safeLandingSpeed: 0.46,
  safeLandingHorizontalSpeed: 0.26,
  safeLandingAngle: 16,
  outOfFuelGraceTime: 28,
  outOfFuelFallSpeed: 0.18,
};

export const FLIGHT_TARGETS = {
  altitude: FLIGHT_WORLD.targetOrbitAltitude,
  orbitalVelocity: FLIGHT_WORLD.orbitTargetHorizontalSpeed,
};

export default class FlightModel {
  constructor(stats) {
    this.stats = stats;
    this.guidance = clamp(
      stats.stability * 0.68 + stats.balanceScore * 0.32,
      0.18,
      1,
    );
    this.fuelMassFactor =
      stats.fuel > 0
        ? clamp(
            (stats.mass * 0.54) / Math.max(stats.fuel, 1),
            0.06,
            FLIGHT_WORLD.fuelMassFactor,
          )
        : 0;
    this.dryMass = Math.max(10, stats.mass - stats.fuel * this.fuelMassFactor);
    this.turnAuthority =
      FLIGHT_WORLD.baseTurnAuthority * (0.5 + this.guidance * 0.7);
    this.dragCoefficient =
      FLIGHT_WORLD.dragBase +
      Math.max(0, (stats.width || 1) - 1) * FLIGHT_WORLD.dragWidthPenalty +
      (1 - this.guidance) * FLIGHT_WORLD.dragInstabilityPenalty;
    this.burnRate = Math.max(0.24, stats.fuelUse * FLIGHT_WORLD.fuelBurnScale);
    this.maxPitchUp = degToRad(-170);
    this.maxPitchDown = degToRad(20);
  }

  createInitialState() {
    const state = {
      downrange: 0,
      altitude: 0,
      horizontalVelocity: 0,
      verticalVelocity: 0,
      position: { x: 0, y: -FLIGHT_WORLD.planetRadius },
      velocity: { x: 0, y: 0 },
      radius: FLIGHT_WORLD.planetRadius,
      speed: 0,
      radialVelocity: 0,
      tangentialVelocity: 0,
      fuelRemaining: this.stats.fuel,
      time: 0,
      simulationTime: 0,
      localOrientation: -Math.PI / 2,
      orientation: -Math.PI / 2,
      angularVelocity: 0,
      throttle: 0,
      steerInput: 0,
      engineOn: false,
      launched: false,
      result: null,
      reason: "",
      phaseId: FLIGHT_PHASES.PAD,
      phase: getPhaseLabel(FLIGHT_PHASES.PAD),
      flightScore: 0,
      wobble: 0,
      atmosphereDensity: 1,
      apoapsis: 0,
      periapsis: 0,
      orbitHoldTime: 0,
      orbitAchieved: false,
      escapeProgress: 0,
      targetOrbitRadius:
        FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude,
      targetOrbitVelocity: FLIGHT_TARGETS.orbitalVelocity,
      currentG: 1,
    };

    this.syncDerivedState(state);
    return state;
  }

  getCurrentMass(state) {
    return this.dryMass + state.fuelRemaining * this.fuelMassFactor;
  }

  getCurrentTwr(state) {
    const mass = Math.max(this.getCurrentMass(state), 1);
    return (this.stats.thrust * FLIGHT_WORLD.thrustScale) / mass / FLIGHT_WORLD.gravity;
  }

  getStabilityTargetAngle(state) {
    const turnProgress = clamp(
      (state.altitude - FLIGHT_WORLD.turnStartAltitude) /
        Math.max(FLIGHT_WORLD.orbitMinAltitude - FLIGHT_WORLD.turnStartAltitude, 1),
      0,
      1,
    );
    const desiredDegrees = -90 + turnProgress * 72;
    return degToRad(desiredDegrees);
  }

  buildWorldPose(
    altitude,
    downrange,
    localOrientation,
    horizontalVelocity,
    verticalVelocity,
  ) {
    const radius = FLIGHT_WORLD.planetRadius + Math.max(altitude, 0);
    const arcAngle = downrange / Math.max(radius, FLIGHT_WORLD.planetRadius);
    const radialUnit = {
      x: Math.sin(arcAngle),
      y: -Math.cos(arcAngle),
    };
    const tangentUnit = {
      x: Math.cos(arcAngle),
      y: Math.sin(arcAngle),
    };

    return {
      radius,
      position: {
        x: radialUnit.x * radius,
        y: radialUnit.y * radius,
      },
      velocity: {
        x:
          tangentUnit.x * horizontalVelocity +
          radialUnit.x * verticalVelocity,
        y:
          tangentUnit.y * horizontalVelocity +
          radialUnit.y * verticalVelocity,
      },
      orientation: localOrientation + arcAngle,
    };
  }

  syncDerivedState(state) {
    const pose = this.buildWorldPose(
      state.altitude,
      state.downrange,
      state.localOrientation,
      state.horizontalVelocity,
      state.verticalVelocity,
    );

    state.position = pose.position;
    state.velocity = pose.velocity;
    state.orientation = pose.orientation;
    state.radius = pose.radius;
    state.speed = Math.hypot(state.horizontalVelocity, state.verticalVelocity);
    state.radialVelocity = state.verticalVelocity;
    state.tangentialVelocity = state.horizontalVelocity;
    state.flightScore = clamp(
      state.altitude / Math.max(FLIGHT_WORLD.targetOrbitAltitude, 1) * 0.45 +
        Math.abs(state.horizontalVelocity) /
          Math.max(FLIGHT_TARGETS.orbitalVelocity, 0.01) *
          0.55,
      0,
      1,
    );
    state.escapeProgress = clamp(
      state.altitude / Math.max(FLIGHT_WORLD.earthEscapeAltitude, 1),
      0,
      1,
    );
    return state;
  }

  step(state, dt, controls = {}) {
    if (state.result) {
      return state;
    }

    state.time += dt;
    state.simulationTime += dt;
    state.engineOn = Boolean(controls.engineOn ?? state.engineOn);
    state.steerInput = clamp(controls.steer ?? 0, -1, 1);
    state.throttle = state.engineOn
      ? clamp(controls.throttle ?? state.throttle, 0, 1)
      : 0;

    if (!state.launched && state.throttle > 0.08 && this.getCurrentTwr(state) > 1) {
      state.launched = true;
    }

    state.atmosphereDensity = clamp(
      1 - state.altitude / FLIGHT_WORLD.atmosphereHeight,
      0,
      1,
    );

    if (!state.launched) {
      state.angularVelocity *= Math.max(0, 1 - dt * (FLIGHT_WORLD.angularDamping + 1));
      state.localOrientation +=
        angleDifference(-Math.PI / 2, state.localOrientation) *
        Math.min(1, dt * (3 + this.guidance * 2));
      state.currentG =
        state.engineOn && state.throttle > 0
          ? clamp(this.getCurrentTwr(state) * state.throttle, 1, 4)
          : 1;
      return this.syncDerivedState(state);
    }

    const autoTrim =
      angleDifference(this.getStabilityTargetAngle(state), state.localOrientation) *
      (0.1 + state.atmosphereDensity * 0.12 + this.guidance * 0.05);
    state.angularVelocity += state.steerInput * this.turnAuthority * dt;
    state.angularVelocity += autoTrim * dt;
    state.angularVelocity *= Math.max(
      0,
      1 - dt * (FLIGHT_WORLD.angularDamping + this.guidance),
    );
    state.localOrientation = clamp(
      state.localOrientation + state.angularVelocity * dt,
      this.maxPitchUp,
      this.maxPitchDown,
    );

    let throttle = state.throttle;
    if (state.fuelRemaining <= 0.01) {
      throttle = 0;
      state.throttle = 0;
    }

    if (throttle > 0) {
      state.fuelRemaining = Math.max(
        0,
        state.fuelRemaining - this.burnRate * throttle * dt,
      );
    }

    const mass = Math.max(this.getCurrentMass(state), 1);
    const thrustAcceleration =
      throttle > 0
        ? (this.stats.thrust * FLIGHT_WORLD.thrustScale * throttle) / mass
        : 0;
    const thrustVector = {
      x: Math.cos(state.localOrientation) * thrustAcceleration,
      y: -Math.sin(state.localOrientation) * thrustAcceleration,
    };
    const localVelocity = {
      x: state.horizontalVelocity,
      y: state.verticalVelocity,
    };
    const speed = length(localVelocity);
    const dragStrength =
      speed * speed * this.dragCoefficient * state.atmosphereDensity;
    const dragVector =
      speed > 0
        ? {
            x: (localVelocity.x / speed) * dragStrength,
            y: (localVelocity.y / speed) * dragStrength,
          }
        : { x: 0, y: 0 };

    state.horizontalVelocity += (thrustVector.x - dragVector.x) * dt;
    state.verticalVelocity +=
      (thrustVector.y - FLIGHT_WORLD.gravity - dragVector.y) * dt;
    state.downrange += state.horizontalVelocity * dt;
    state.altitude = Math.max(0, state.altitude + state.verticalVelocity * dt);
    state.atmosphereDensity = clamp(
      1 - state.altitude / FLIGHT_WORLD.atmosphereHeight,
      0,
      1,
    );
    state.apoapsis = Math.max(
      state.apoapsis,
      state.altitude,
      this.estimateBallisticApoapsis(state),
    );
    state.periapsis =
      state.time > 0.5
        ? Math.min(
            state.periapsis || state.altitude,
            this.estimateBallisticPeriapsis(state),
          )
        : state.altitude;
    state.currentG = clamp(
      Math.hypot(
        thrustVector.x - dragVector.x,
        thrustVector.y - dragVector.y - FLIGHT_WORLD.gravity,
      ) / Math.max(FLIGHT_WORLD.gravity, 0.001),
      0,
      9.9,
    );

    return this.syncDerivedState(state);
  }

  estimateBallisticApoapsis(state) {
    if (state.verticalVelocity <= 0) {
      return state.altitude;
    }

    const falloff = 1 - state.atmosphereDensity * 0.35;
    return (
      state.altitude +
      (state.verticalVelocity * state.verticalVelocity) /
        (2 * Math.max(FLIGHT_WORLD.gravity, 0.001)) *
        falloff
    );
  }

  estimateBallisticPeriapsis(state) {
    if (state.verticalVelocity >= 0) {
      return state.altitude;
    }

    const descent =
      (state.verticalVelocity * state.verticalVelocity) /
      (2 * Math.max(FLIGHT_WORLD.gravity, 0.001));
    return Math.max(0, state.altitude - descent);
  }

  predictPath(state) {
    if (!state.launched) {
      return {
        points: [],
        apoapsis: state.altitude,
        periapsis: state.altitude,
        apoapsisPoint: null,
        corridorPoint: null,
      };
    }

    const step = 0.08;
    const steps = 240;
    const burnSteps =
      state.engineOn && state.fuelRemaining > 0.01
        ? Math.round(steps * 0.2)
        : 0;
    const predicted = {
      altitude: state.altitude,
      downrange: state.downrange,
      horizontalVelocity: state.horizontalVelocity,
      verticalVelocity: state.verticalVelocity,
      localOrientation: state.localOrientation,
      fuelRemaining: state.fuelRemaining,
    };

    const points = [];
    let apoapsis = state.altitude;
    let periapsis = state.altitude;
    let apoapsisPoint = { ...state.position };
    let corridorPoint = null;
    let bestCorridorDelta = Number.POSITIVE_INFINITY;

    for (let index = 0; index < steps; index += 1) {
      const atmosphereDensity = clamp(
        1 - predicted.altitude / FLIGHT_WORLD.atmosphereHeight,
        0,
        1,
      );
      const mass =
        this.dryMass + predicted.fuelRemaining * this.fuelMassFactor;
      const throttle = index < burnSteps ? state.throttle : 0;

      if (throttle > 0 && predicted.fuelRemaining > 0) {
        predicted.fuelRemaining = Math.max(
          0,
          predicted.fuelRemaining - this.burnRate * throttle * step,
        );
      }

      const thrustAcceleration =
        throttle > 0
          ? (this.stats.thrust * FLIGHT_WORLD.thrustScale * throttle) /
            Math.max(mass, 1)
          : 0;
      const thrustVector = {
        x: Math.cos(predicted.localOrientation) * thrustAcceleration,
        y: -Math.sin(predicted.localOrientation) * thrustAcceleration,
      };
      const speed = Math.hypot(
        predicted.horizontalVelocity,
        predicted.verticalVelocity,
      );
      const dragStrength =
        speed * speed * this.dragCoefficient * atmosphereDensity;
      const dragVector =
        speed > 0
          ? {
              x: (predicted.horizontalVelocity / speed) * dragStrength,
              y: (predicted.verticalVelocity / speed) * dragStrength,
            }
          : { x: 0, y: 0 };

      predicted.horizontalVelocity += (thrustVector.x - dragVector.x) * step;
      predicted.verticalVelocity +=
        (thrustVector.y - FLIGHT_WORLD.gravity - dragVector.y) * step;
      predicted.downrange += predicted.horizontalVelocity * step;
      predicted.altitude = Math.max(
        0,
        predicted.altitude + predicted.verticalVelocity * step,
      );

      const pose = this.buildWorldPose(
        predicted.altitude,
        predicted.downrange,
        predicted.localOrientation,
        predicted.horizontalVelocity,
        predicted.verticalVelocity,
      );

      if (index % 3 === 0) {
        points.push({ ...pose.position });
      }

      if (predicted.altitude > apoapsis) {
        apoapsis = predicted.altitude;
        apoapsisPoint = { ...pose.position };
      }
      periapsis = Math.min(periapsis, predicted.altitude);

      const corridorDelta =
        Math.abs(predicted.altitude - FLIGHT_WORLD.targetOrbitAltitude) +
        Math.abs(
          Math.abs(predicted.horizontalVelocity) -
            FLIGHT_TARGETS.orbitalVelocity,
        ) *
          45 +
        Math.abs(predicted.verticalVelocity) * 28;
      if (corridorDelta < bestCorridorDelta) {
        bestCorridorDelta = corridorDelta;
        corridorPoint = { ...pose.position };
      }

      if (predicted.altitude <= 0 && index > 12) {
        break;
      }
    }

    return {
      points,
      apoapsis,
      periapsis,
      apoapsisPoint,
      corridorPoint,
    };
  }
}
