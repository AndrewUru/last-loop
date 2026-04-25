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

export function getPresentationAltitude(altitude) {
  const earlyProgress = Phaser.Math.Clamp(
    altitude / LAUNCH_PRESENTATION_ALTITUDE,
    0,
    1,
  );
  const presentationBoost = 1 + (1 - Math.pow(earlyProgress, 0.72)) * 7.5;

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
