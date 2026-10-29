import Phaser from "phaser";
import {
  LAUNCH_PRESENTATION_ALTITUDE,
  MAX_ZOOM_FACTOR,
  MIN_ZOOM_FACTOR,
  ZOOM_WHEEL_STEP,
} from "./FlightSceneConstants.js";

export function angleDifference(target, current) {
  let delta = target - current;

  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }

  return delta;
}

export function getBuildCenter(bounds) {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: bounds.maxY,
  };
}

// Phaser's WebGL renderer turns every Graphics circle into ~100 points and
// re-triangulates it on the CPU each frame. Particles and flames draw hundreds
// of them, so they use a 12-sided triangle fan instead.
const DOT_SIDES = 12;
const DOT_COS = Array.from({ length: DOT_SIDES }, (_, i) => Math.cos((i / DOT_SIDES) * Math.PI * 2));
const DOT_SIN = Array.from({ length: DOT_SIDES }, (_, i) => Math.sin((i / DOT_SIDES) * Math.PI * 2));

export function fillDot(graphics, x, y, radius) {
  const x0 = x + DOT_COS[0] * radius;
  const y0 = y + DOT_SIN[0] * radius;
  for (let i = 1; i < DOT_SIDES - 1; i += 1) {
    graphics.fillTriangle(
      x0,
      y0,
      x + DOT_COS[i] * radius,
      y + DOT_SIN[i] * radius,
      x + DOT_COS[i + 1] * radius,
      y + DOT_SIN[i + 1] * radius,
    );
  }
}

export function getPresentationAltitude(altitude) {
  const earlyProgress = Phaser.Math.Clamp(
    altitude / LAUNCH_PRESENTATION_ALTITUDE,
    0,
    1,
  );
  const padClearanceBoost = Phaser.Math.Clamp(1 - altitude / 24, 0, 1) * 42;
  const ascentReadabilityBoost = (1 - Math.pow(earlyProgress, 0.72)) * 7.5;
  const presentationBoost = 1 + padClearanceBoost + ascentReadabilityBoost;

  return altitude * presentationBoost;
}

export function getRenderPosition(state) {
  const altitude = getPresentationAltitude(state.altitude);

  return {
    x: state.position.x,
    y: state.position.y - (altitude - state.altitude),
    altitude,
  };
}

export function updateZoomFactor(currentZoomFactor, deltaY) {
  return Phaser.Math.Clamp(
    currentZoomFactor + (deltaY > 0 ? -ZOOM_WHEEL_STEP : ZOOM_WHEEL_STEP),
    MIN_ZOOM_FACTOR,
    MAX_ZOOM_FACTOR,
  );
}

export function getThrustVisual(state) {
  return state.engineOn && state.fuelRemaining > 0 ? state.throttle : 0;
}

export function acquireParticle(pool) {
  return pool.pop() || null;
}

export function releaseParticle(activeParticles, pool, index) {
  const lastParticle = activeParticles[activeParticles.length - 1];
  const particleToRelease = activeParticles[index];

  activeParticles[index] = lastParticle;
  activeParticles.pop();

  if (particleToRelease) {
    pool.push(particleToRelease);
  }
}
