function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function length(vector) {
  return Math.hypot(vector.x, vector.y);
}

function normalize(vector) {
  const vectorLength = length(vector) || 1;
  return {
    x: vector.x / vectorLength,
    y: vector.y / vectorLength,
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

export const FLIGHT_WORLD = {
  planetRadius: 260,
  atmosphereHeight: 110,
  targetOrbitAltitude: 220,
  earthEscapeAltitude: 430,
  orbitLockDuration: 5,
  gravitationalParameter: 4500,
  simulationRate: 0.05,
  preOrbitFuelFailureTime: 480,
  postOrbitFuelFailureTime: 780,
  missionTimeout: 1200,
};

export const FLIGHT_TARGETS = {
  altitude: FLIGHT_WORLD.targetOrbitAltitude,
  orbitalVelocity: Math.sqrt(
    FLIGHT_WORLD.gravitationalParameter /
      (FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude),
  ),
};

export default class FlightSimulator {
  constructor(stats) {
    this.stats = stats;
    this.state = {
      position: {
        x: 0,
        y: -(FLIGHT_WORLD.planetRadius + 8),
      },
      velocity: {
        x: 0,
        y: 0,
      },
      radius: FLIGHT_WORLD.planetRadius + 8,
      altitude: 8,
      speed: 0,
      radialVelocity: 0,
      tangentialVelocity: 0,
      fuelRemaining: stats.fuel,
      time: 0,
      simulationTime: 0,
      orientation: -Math.PI / 2,
      angularVelocity: 0,
      throttle: 0,
      steerInput: 0,
      engineOn: false,
      launched: false,
      result: null,
      reason: "",
      phase: "Pad Idle",
      flightScore: 0,
      wobble: 0,
      atmosphereDensity: 1,
      apoapsis: 8,
      periapsis: 8,
      orbitHoldTime: 0,
      orbitAchieved: false,
      escapeProgress: 0,
      targetOrbitRadius: FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude,
      targetOrbitVelocity: FLIGHT_TARGETS.orbitalVelocity,
      currentG: 1,
    };
  }

  update(delta, controls = {}) {
    if (this.state.result) {
      return this.state;
    }

    const dt = Math.min(delta / 1000, 0.05);
    const simulationDt = dt * FLIGHT_WORLD.simulationRate;
    const guidance = clamp(
      this.stats.stability * 0.72 + this.stats.balanceScore * 0.28,
      0.12,
      1,
    );
    const engineOn = Boolean(controls.engineOn ?? this.state.engineOn);
    const throttleCommand = clamp(controls.throttle ?? this.state.throttle, 0, 1);
    const throttle = engineOn ? throttleCommand : 0;
    const steerInput = clamp(controls.steer ?? 0, -1, 1);
    const radiusVector = { ...this.state.position };
    const radius = length(radiusVector);
    const radialUnit = normalize(radiusVector);
    const tangentUnit = {
      x: -radialUnit.y,
      y: radialUnit.x,
    };
    const gravityStrength =
      FLIGHT_WORLD.gravitationalParameter / Math.max(radius * radius, 1);
    const altitude = radius - FLIGHT_WORLD.planetRadius;
    const atmosphereDensity = clamp(
      1 - altitude / FLIGHT_WORLD.atmosphereHeight,
      0,
      1,
    );
    const wobbleStrength =
      (1 - guidance) * (0.2 + atmosphereDensity * 0.9 + clamp(altitude / 260, 0, 0.35));

    this.state.time += dt;
    this.state.simulationTime += simulationDt;
    this.state.throttle = throttle;
    this.state.steerInput = steerInput;
    this.state.engineOn = engineOn;
    this.state.radius = radius;
    this.state.altitude = altitude;
    this.state.atmosphereDensity = atmosphereDensity;
    this.state.wobble =
      Math.sin(this.state.simulationTime * (2.6 + wobbleStrength * 6.2)) *
      wobbleStrength *
      0.22;

    if (!this.state.launched && throttle > 0.02 && this.state.fuelRemaining > 0.01) {
      this.state.launched = true;
    }

    if (!this.state.launched) {
      this.state.velocity.x = 0;
      this.state.velocity.y = 0;
      this.state.angularVelocity = 0;
      this.state.phase = this.resolvePhase(altitude, 0);
      this.state.speed = 0;
      this.state.radialVelocity = 0;
      this.state.tangentialVelocity = 0;
      this.state.currentG = engineOn ? 1.2 + throttle * 0.6 : 1;
      return this.state;
    }

    const turnRate = (0.9 + guidance * 1.3) * (0.8 + atmosphereDensity * 0.3);
    this.state.angularVelocity *= 0.92;
    this.state.angularVelocity += steerInput * turnRate * simulationDt * 2.8;
    this.state.orientation +=
      this.state.angularVelocity + this.state.wobble * simulationDt;

    const hasFuel = this.state.fuelRemaining > 0.01 && throttle > 0.02;
    let thrustAcceleration = { x: 0, y: 0 };

    if (hasFuel) {
      const thrustDirection = {
        x: Math.cos(this.state.orientation),
        y: Math.sin(this.state.orientation),
      };
      const maxThrustAcceleration = 0.13 + this.stats.twr * 0.07;
      const launchAssistMultiplier = 1 + Math.max(0, 1 - altitude / 24) * 0.55;
      thrustAcceleration = {
        x:
          thrustDirection.x *
          maxThrustAcceleration *
          throttle *
          launchAssistMultiplier,
        y:
          thrustDirection.y *
          maxThrustAcceleration *
          throttle *
          launchAssistMultiplier,
      };

      const fuelSpent = Math.min(
        this.state.fuelRemaining,
        this.stats.fuelUse * throttle * simulationDt,
      );
      this.state.fuelRemaining -= fuelSpent;
    }

    const gravityAcceleration = {
      x: -radialUnit.x * gravityStrength,
      y: -radialUnit.y * gravityStrength,
    };
    const dragStrength =
      atmosphereDensity * atmosphereDensity * (0.012 + Math.max(this.stats.mass - 22, 0) * 0.00012);
    const dragAcceleration = {
      x: -this.state.velocity.x * dragStrength,
      y: -this.state.velocity.y * dragStrength,
    };

    const totalAcceleration = {
      x: gravityAcceleration.x + thrustAcceleration.x + dragAcceleration.x,
      y: gravityAcceleration.y + thrustAcceleration.y + dragAcceleration.y,
    };

    this.state.velocity.x += totalAcceleration.x * simulationDt;
    this.state.velocity.y += totalAcceleration.y * simulationDt;
    this.state.position.x += this.state.velocity.x * simulationDt * 60;
    this.state.position.y += this.state.velocity.y * simulationDt * 60;

    const updatedRadiusVector = { ...this.state.position };
    const updatedRadius = length(updatedRadiusVector);
    const updatedRadialUnit = normalize(updatedRadiusVector);
    const updatedTangentUnit = {
      x: -updatedRadialUnit.y,
      y: updatedRadialUnit.x,
    };
    const radialVelocity = dot(this.state.velocity, updatedRadialUnit);
    const tangentialVelocity = dot(this.state.velocity, updatedTangentUnit);
    const speed = length(this.state.velocity);
    const updatedAltitude = updatedRadius - FLIGHT_WORLD.planetRadius;

    this.state.radius = updatedRadius;
    this.state.altitude = updatedAltitude;
    this.state.speed = speed;
    this.state.radialVelocity = radialVelocity;
    this.state.tangentialVelocity = tangentialVelocity;
    this.state.apoapsis = Math.max(this.state.apoapsis, updatedAltitude);
    this.state.periapsis =
      this.state.time > 0.6
        ? Math.min(this.state.periapsis, updatedAltitude)
        : updatedAltitude;
    this.state.currentG = clamp(
      length(totalAcceleration) / 0.098,
      0,
      9.9,
    );

    const nearTargetOrbit =
      Math.abs(updatedAltitude - FLIGHT_WORLD.targetOrbitAltitude) < 28 &&
      Math.abs(radialVelocity) < 0.16 &&
      Math.abs(Math.abs(tangentialVelocity) - FLIGHT_TARGETS.orbitalVelocity) < 0.38;

    if (nearTargetOrbit) {
      this.state.orbitHoldTime += dt;
    } else {
      this.state.orbitHoldTime = Math.max(0, this.state.orbitHoldTime - dt * 0.45);
    }

    this.state.flightScore = clamp(
      updatedAltitude / FLIGHT_WORLD.targetOrbitAltitude * 0.5 +
        Math.abs(tangentialVelocity) / FLIGHT_TARGETS.orbitalVelocity * 0.5,
      0,
      1,
    );
    this.state.escapeProgress = clamp(
      (updatedAltitude - FLIGHT_WORLD.targetOrbitAltitude) /
        (FLIGHT_WORLD.earthEscapeAltitude - FLIGHT_WORLD.targetOrbitAltitude),
      0,
      1,
    );

    if (updatedAltitude < -4 && this.state.time > 1.5) {
      return this.fail("The vehicle impacted the planet before achieving orbit.");
    }

    if (
      guidance < 0.28 &&
      atmosphereDensity > 0.6 &&
      speed > 0.13 &&
      Math.abs(this.state.angularVelocity) > 0.045
    ) {
      return this.fail("Aerodynamic stress broke the vehicle apart.");
    }

    if (this.state.orbitHoldTime >= FLIGHT_WORLD.orbitLockDuration) {
      this.state.orbitAchieved = true;
      return this.succeed("Stable orbit achieved. Mission complete.");
    }

    if (
      this.state.fuelRemaining <= 0.01 &&
      !this.state.orbitAchieved &&
      this.state.apoapsis < FLIGHT_WORLD.targetOrbitAltitude * 0.88 &&
      updatedAltitude < FLIGHT_WORLD.atmosphereHeight * 0.6 &&
      this.state.time > FLIGHT_WORLD.preOrbitFuelFailureTime
    ) {
      return this.fail("Not enough delta-v to reach the orbital corridor.");
    }

    if (this.state.time > FLIGHT_WORLD.missionTimeout) {
      return this.fail("Mission timed out before achieving stable orbit.");
    }

    this.state.phase = this.resolvePhase(updatedAltitude, tangentialVelocity);
    return this.state;
  }

  resolvePhase(altitude, tangentialVelocity) {
    if (!this.state.launched) {
      return this.state.engineOn ? "Liftoff" : "Pad Idle";
    }
    if (this.state.orbitHoldTime > 0.5) {
      return "Orbit Lock";
    }
    if (this.state.orbitAchieved) {
      return "Stable Orbit";
    }
    if (altitude < FLIGHT_WORLD.atmosphereHeight * 0.3) {
      return "Atmospheric Ascent";
    }
    if (altitude < FLIGHT_WORLD.atmosphereHeight) {
      return "Upper Atmosphere";
    }
    if (Math.abs(tangentialVelocity) < FLIGHT_TARGETS.orbitalVelocity * 0.75) {
      return "Orbital Injection";
    }
    return "Coast";
  }

  succeed(reason) {
    this.state.result = "success";
    this.state.reason = reason;
    this.state.phase = "Stable Orbit";
    return this.state;
  }

  fail(reason) {
    this.state.result = "failure";
    this.state.reason = reason;
    this.state.phase = "Failure";
    return this.state;
  }
}
