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

export const FLIGHT_WORLD = {
  planetRadius: 260,
  atmosphereHeight: 110,
  orbitMinAltitude: 170,
  targetOrbitAltitude: 220,
  earthEscapeAltitude: 430,
  // Lateral speed at which the rocket stops falling. Gravity fades out as the
  // rocket approaches it, so "go sideways fast enough" is the whole orbit rule.
  orbitTargetHorizontalSpeed: 5,
  orbitSpeedRatio: 0.96,
  // Flight path must be within this many degrees of level to lock the orbit.
  orbitMaxPathAngle: 15,
  orbitLockDuration: 1.5,
  guidanceStartAltitude: 2,
  guidanceAltitude: 190,
  guidanceGain: 0.3,
  guidanceGravityFloor: 0.05,
  turnProfileAltitude: 150,
  turnProfileEndPitch: 10,
  missionTimeout: 300,
  gravity: 0.196,
  fuelBurnScale: 1.1,
  fuelMassFactor: 0.16,
  // Degrees per second while a steer key is held. The rocket holds its
  // heading as soon as the key is released.
  baseTurnRate: 34,
  turnResponse: 7,
  dragBase: 0.006,
  dragWidthPenalty: 0.0025,
  safeLandingSpeed: 0.46,
  safeLandingHorizontalSpeed: 0.26,
  safeLandingAngle: 16,
  outOfFuelGraceTime: 1.5,
};

export const FLIGHT_TARGETS = {
  altitude: FLIGHT_WORLD.targetOrbitAltitude,
  orbitalVelocity: FLIGHT_WORLD.orbitTargetHorizontalSpeed,
};

export default class FlightModel {
  constructor(stats) {
    this.stats = stats;
    this.fuelMassFactor =
      stats.fuel > 0
        ? clamp(
            (stats.mass * 0.54) / Math.max(stats.fuel, 1),
            0.06,
            FLIGHT_WORLD.fuelMassFactor,
          )
        : 0;
    this.dryMass = Math.max(1, stats.mass - stats.fuel * this.fuelMassFactor);
    // stats.twr is the liftoff thrust-to-weight ratio shown in the hangar.
    this.thrustForce = (stats.twr || 0) * FLIGHT_WORLD.gravity * stats.mass;
    this.burnRate = Math.max(0.2, stats.fuelUse * FLIGHT_WORLD.fuelBurnScale);
    this.turnRate = degToRad(
      FLIGHT_WORLD.baseTurnRate * (1 + (stats.controlAuthority || 0) * 2),
    );
    this.dragCoefficient =
      (FLIGHT_WORLD.dragBase +
        Math.max(0, (stats.width || 1) - 1) * FLIGHT_WORLD.dragWidthPenalty) *
      (1 - clamp(stats.dragReduction || 0, 0, 0.5));
    this.maxPitchUp = degToRad(-170);
    this.maxPitchDown = degToRad(30);
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
      fuelRemaining: this.stats.fuel,
      time: 0,
      localOrientation: -Math.PI / 2,
      orientation: -Math.PI / 2,
      angularVelocity: 0,
      throttle: 0,
      steerInput: 0,
      guidanceAngle: -Math.PI / 2,
      guidanceError: 0,
      insertionStarted: false,
      engineOn: false,
      launched: false,
      result: null,
      failure: null,
      reason: "",
      phaseId: FLIGHT_PHASES.PAD,
      phase: getPhaseLabel(FLIGHT_PHASES.PAD),
      atmosphereDensity: 1,
      apoapsis: 0,
      orbitWindow: false,
      cutEngineCue: false,
      pathAngle: 90,
      orbitHoldTime: 0,
      orbitAchieved: false,
      outOfFuelTime: 0,
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
    return this.thrustForce / mass / FLIGHT_WORLD.gravity;
  }

  getEffectiveGravity(horizontalVelocity) {
    const ratio = horizontalVelocity / FLIGHT_WORLD.orbitTargetHorizontalSpeed;
    return FLIGHT_WORLD.gravity * Math.max(0, 1 - ratio * ratio);
  }

  estimateCoastApoapsis(state) {
    if (state.verticalVelocity <= 0) {
      return state.altitude;
    }

    const gravity = this.getEffectiveGravity(state.horizontalVelocity);
    if (gravity <= 0.001) {
      return FLIGHT_WORLD.earthEscapeAltitude;
    }

    return Math.min(
      FLIGHT_WORLD.earthEscapeAltitude,
      state.altitude + (state.verticalVelocity * state.verticalVelocity) / (2 * gravity),
    );
  }

  // Heading the HUD arrow asks the pilot to hold, as a local orientation
  // (-90 deg is straight up, 0 deg is level flight towards orbit).
  // Picks the climb rate that would coast up to the guidance altitude and
  // tilts the thrust so only the vertical share needed for it goes up;
  // everything else becomes orbital speed. A pitch cap that drops with
  // altitude keeps the turn gradual instead of "straight up, then sideways".
  getGuidanceTarget(state) {
    const world = FLIGHT_WORLD;

    if (!state.launched || state.altitude < world.guidanceStartAltitude) {
      return degToRad(-90);
    }

    const altitudeError = world.guidanceAltitude - state.altitude;
    const gravity = Math.max(this.getEffectiveGravity(state.horizontalVelocity), 0);
    const desiredClimb =
      altitudeError >= 0
        ? Math.sqrt((gravity + world.guidanceGravityFloor) * altitudeError)
        : Math.max(-0.3, altitudeError / 20);
    const mass = Math.max(this.getCurrentMass(state), 1);
    const thrustAcceleration = Math.max(this.thrustForce / mass, 0.01);
    const verticalNeed =
      gravity + (desiredClimb - state.verticalVelocity) * world.guidanceGain;
    const turnProgress = clamp(state.altitude / world.turnProfileAltitude, 0, 1);
    const pitchCap = degToRad(90 - (90 - world.turnProfileEndPitch) * Math.pow(turnProgress, 0.75));
    const pitch = Math.min(
      Math.asin(clamp(verticalNeed / thrustAcceleration, -0.5, 1)),
      pitchCap,
    );
    return -pitch;
  }

  updateGuidance(state, dt) {
    const target = this.getGuidanceTarget(state);
    state.guidanceAngle +=
      angleDifference(target, state.guidanceAngle) * Math.min(1, dt * 2.5);
    state.guidanceError = angleDifference(state.guidanceAngle, state.localOrientation);
  }

  updateOrientation(state, dt) {
    const targetRate = state.steerInput * this.turnRate;
    state.angularVelocity +=
      (targetRate - state.angularVelocity) *
      Math.min(1, dt * FLIGHT_WORLD.turnResponse);
    state.localOrientation = clamp(
      state.localOrientation + state.angularVelocity * dt,
      this.maxPitchUp,
      this.maxPitchDown,
    );

    if (
      (state.localOrientation === this.maxPitchUp && state.angularVelocity < 0) ||
      (state.localOrientation === this.maxPitchDown && state.angularVelocity > 0)
    ) {
      state.angularVelocity = 0;
    }
  }

  buildWorldPose(altitude, downrange, localOrientation, horizontalVelocity, verticalVelocity) {
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
      arcAngle,
      position: {
        x: radialUnit.x * radius,
        y: radialUnit.y * radius,
      },
      velocity: {
        x: tangentUnit.x * horizontalVelocity + radialUnit.x * verticalVelocity,
        y: tangentUnit.y * horizontalVelocity + radialUnit.y * verticalVelocity,
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
    state.arcAngle = pose.arcAngle;
    state.radius = pose.radius;
    state.speed = Math.hypot(state.horizontalVelocity, state.verticalVelocity);
    state.apoapsis = this.estimateCoastApoapsis(state);
    return state;
  }

  step(state, dt, controls = {}) {
    if (state.orbitAchieved) {
      state.time += dt;
      return this.updateStableOrbit(state, dt);
    }

    if (state.result) {
      return state;
    }

    state.time += dt;
    state.engineOn = Boolean(controls.engineOn) && state.fuelRemaining > 0.01;
    state.throttle = state.engineOn ? clamp(controls.throttle ?? 1, 0, 1) : 0;
    state.steerInput = state.launched ? clamp(controls.steer ?? 0, -1, 1) : 0;

    if (!state.launched && state.throttle > 0 && this.getCurrentTwr(state) * state.throttle > 1) {
      state.launched = true;
    }

    state.atmosphereDensity = clamp(1 - state.altitude / FLIGHT_WORLD.atmosphereHeight, 0, 1);
    this.updateGuidance(state, dt);

    if (!state.launched) {
      state.currentG = 1;
      return this.syncDerivedState(state);
    }

    this.updateOrientation(state, dt);

    const throttle = state.throttle;
    if (throttle > 0) {
      state.fuelRemaining = Math.max(0, state.fuelRemaining - this.burnRate * throttle * dt);
    }

    const mass = Math.max(this.getCurrentMass(state), 1);
    const thrustAcceleration = throttle > 0 ? (this.thrustForce * throttle) / mass : 0;
    const thrust = {
      x: Math.cos(state.localOrientation) * thrustAcceleration,
      y: -Math.sin(state.localOrientation) * thrustAcceleration,
    };
    const drag = this.getDrag(state.horizontalVelocity, state.verticalVelocity, state.atmosphereDensity);
    const gravity = this.getEffectiveGravity(state.horizontalVelocity);

    state.horizontalVelocity += (thrust.x - drag.x) * dt;
    state.verticalVelocity += (thrust.y - gravity - drag.y) * dt;
    state.downrange += state.horizontalVelocity * dt;
    state.altitude = Math.max(0, state.altitude + state.verticalVelocity * dt);
    state.atmosphereDensity = clamp(1 - state.altitude / FLIGHT_WORLD.atmosphereHeight, 0, 1);
    state.currentG = clamp(
      Math.hypot(thrust.x - drag.x, thrust.y - drag.y) / FLIGHT_WORLD.gravity,
      0,
      9.9,
    );

    return this.syncDerivedState(state);
  }

  getDrag(horizontalVelocity, verticalVelocity, atmosphereDensity) {
    const speed = Math.hypot(horizontalVelocity, verticalVelocity);
    if (speed <= 0) {
      return { x: 0, y: 0 };
    }

    const strength = speed * speed * this.dragCoefficient * atmosphereDensity;
    return {
      x: (horizontalVelocity / speed) * strength,
      y: (verticalVelocity / speed) * strength,
    };
  }

  // After the orbit locks the vehicle glides onto the target orbit so the
  // camera can pull back for the victory shot.
  updateStableOrbit(state, dt) {
    const targetAltitude = FLIGHT_WORLD.targetOrbitAltitude;
    const targetVelocity = FLIGHT_TARGETS.orbitalVelocity * Math.sign(state.horizontalVelocity || 1);

    state.engineOn = false;
    state.throttle = 0;
    state.altitude += (targetAltitude - state.altitude) * Math.min(1, dt * 0.8);
    state.horizontalVelocity += (targetVelocity - state.horizontalVelocity) * Math.min(1, dt * 0.8);
    state.verticalVelocity *= Math.max(0, 1 - dt * 2.4);
    state.downrange += state.horizontalVelocity * dt;
    const prograde = state.horizontalVelocity >= 0 ? 0 : -Math.PI;
    state.localOrientation += angleDifference(prograde, state.localOrientation) * Math.min(1, dt * 1.4);
    state.angularVelocity = 0;
    state.currentG = 0;
    state.atmosphereDensity = 0;

    return this.syncDerivedState(state);
  }

  predictStableOrbit(state) {
    const radius = FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude;
    const points = [];
    const count = 192;

    for (let index = 0; index <= count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      points.push({ x: Math.sin(angle) * radius, y: -Math.cos(angle) * radius });
    }

    return { points, completeOrbit: true, impact: false };
  }

  // Where the rocket goes if the engine is cut right now.
  predictPath(state) {
    if (!state.launched) {
      return { points: [], completeOrbit: false, impact: false };
    }

    if (state.orbitAchieved) {
      return this.predictStableOrbit(state);
    }

    const step = 0.5;
    const steps = 720;
    const predicted = {
      altitude: state.altitude,
      downrange: state.downrange,
      horizontalVelocity: state.horizontalVelocity,
      verticalVelocity: state.verticalVelocity,
    };
    const points = [];
    let impact = false;

    for (let index = 0; index < steps; index += 1) {
      const density = clamp(1 - predicted.altitude / FLIGHT_WORLD.atmosphereHeight, 0, 1);
      const drag = this.getDrag(predicted.horizontalVelocity, predicted.verticalVelocity, density);
      const gravity = this.getEffectiveGravity(predicted.horizontalVelocity);

      predicted.horizontalVelocity -= drag.x * step;
      predicted.verticalVelocity -= (gravity + drag.y) * step;
      predicted.downrange += predicted.horizontalVelocity * step;
      predicted.altitude += predicted.verticalVelocity * step;

      if (index % 4 === 0) {
        const radius = FLIGHT_WORLD.planetRadius + Math.max(predicted.altitude, 0);
        const arcAngle = predicted.downrange / radius;
        points.push({ x: Math.sin(arcAngle) * radius, y: -Math.cos(arcAngle) * radius });
      }

      if (predicted.altitude <= 0) {
        impact = true;
        break;
      }
      if (
        predicted.altitude >= FLIGHT_WORLD.earthEscapeAltitude ||
        Math.abs(predicted.downrange - state.downrange) >
          Math.PI * 2 * (FLIGHT_WORLD.planetRadius + predicted.altitude)
      ) {
        break;
      }
    }

    return { points, completeOrbit: false, impact };
  }
}
