import Phaser from "phaser";
import { FLIGHT_WORLD } from "../../systems/FlightSimulator.js";
import {
  PRESENTATION_BOOST,
  PRESENTATION_BOOST_SCALE,
  PRESENTATION_FADE_END,
  PRESENTATION_FADE_START,
} from "./FlightSceneConstants.js";

// Phaser's WebGL renderer turns every Graphics circle into ~100 points and
// re-triangulates it on the CPU each frame. The trajectory line draws hundreds
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

// Monotonic: the rocket always moves up on screen while it climbs.
export function getPresentationAltitude(altitude) {
  const clamped = Math.max(0, altitude);
  const fade = Phaser.Math.Clamp(
    (clamped - PRESENTATION_FADE_START) / (PRESENTATION_FADE_END - PRESENTATION_FADE_START),
    0,
    1,
  );
  const keep = 1 - fade * fade * (3 - 2 * fade);
  return (
    clamped +
    PRESENTATION_BOOST * (1 - Math.exp(-clamped / PRESENTATION_BOOST_SCALE)) * keep
  );
}

// Moves a physics-space point radially into the space the rocket is drawn in.
export function toRenderSpace(point) {
  const radius = Math.hypot(point.x, point.y);
  const altitude = radius - FLIGHT_WORLD.planetRadius;
  const scale =
    (FLIGHT_WORLD.planetRadius + getPresentationAltitude(altitude)) / Math.max(radius, 1);
  return { x: point.x * scale, y: point.y * scale };
}

export function getRenderPosition(state) {
  return toRenderSpace(state.position);
}

export function getThrustVisual(state) {
  return state.engineOn && state.fuelRemaining > 0 ? state.throttle : 0;
}
