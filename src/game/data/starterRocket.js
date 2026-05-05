export const STARTER_ROCKET = Object.freeze({
  name: "Starter Rocket",
  parts: Object.freeze([
    { partId: "capsule", cellX: 11, cellY: 7 },
    { partId: "avionics_ring", cellX: 11, cellY: 8 },
    { partId: "fuel_tank_large", cellX: 11, cellY: 9 },
    { partId: "engine_main", cellX: 11, cellY: 12 },
  ]),
});

export function cloneBuildParts(parts = []) {
  return parts.map((part) => ({ ...part }));
}

export function createStarterRocketBuild() {
  return cloneBuildParts(STARTER_ROCKET.parts);
}
