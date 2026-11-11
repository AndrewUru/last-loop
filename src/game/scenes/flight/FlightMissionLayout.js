import { toRenderSpace } from "./FlightSceneUtils.js";

// Leave the tower-clearance part of the ascent free of mission objects.
const MIN_TARGET_ALTITUDE = 20;

export function getRingRadius(rocketHeight) {
  return Math.max(rocketHeight * 0.22, 7);
}

// Show each hoop well before arrival, without displaying the entire course
// over the tower during countdown and liftoff.
export function getRingVisibility(altitude, targetAltitude) {
  const start = Math.max(8, targetAltitude - 40);
  const progress = Math.min(1, Math.max(0, (altitude - start) / 12));
  return progress * progress * (3 - 2 * progress);
}

// Space objects by distance along the rendered path, not by altitude. Near
// orbit the path is almost horizontal, so altitude bunches targets together.
export function placeAlongClimb(path, count, from, to, spread, lift = 0) {
  const points = path.filter(sample => sample.altitude >= MIN_TARGET_ALTITUDE).map(sample => {
    const base = toRenderSpace(sample.position);
    return {
      x: base.x + Math.cos(sample.orientation) * lift,
      y: base.y + Math.sin(sample.orientation) * lift,
      altitude: sample.altitude,
      distance: 0,
    };
  });
  if (points.length < 2 || count <= 0) return [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    points[index].distance = previous.distance + Math.hypot(points[index].x - previous.x, points[index].y - previous.y);
  }
  const total = points.at(-1).distance;
  return Array.from({ length: count }, (_, index) => {
    const share = count === 1 ? (from + to) / 2 : from + (to - from) * index / (count - 1);
    const distance = total * share;
    const end = points.findIndex(point => point.distance >= distance);
    const segment = Math.max(1, end < 0 ? points.length - 1 : end);
    const next = points[segment];
    const previous = points[segment - 1];
    const fraction = (distance - previous.distance) / Math.max(next.distance - previous.distance, 1e-8);
    const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
    const side = (index % 2 === 0 ? 1 : -1) * spread;
    return {
      x: previous.x + (next.x - previous.x) * fraction - Math.sin(angle) * side,
      y: previous.y + (next.y - previous.y) * fraction + Math.cos(angle) * side,
      angle,
      altitude: previous.altitude + (next.altitude - previous.altitude) * fraction,
    };
  });
}
