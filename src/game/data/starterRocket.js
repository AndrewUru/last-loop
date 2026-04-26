export const STARTER_ROCKET = Object.freeze({
  name: "Starter Rocket",
  parts: Object.freeze([
    { partId: "capsule", cellX: 3, cellY: 1 },
    { partId: "avionics_ring", cellX: 3, cellY: 2 },
    { partId: "fuel_tank_large", cellX: 3, cellY: 3 },
    { partId: "engine_main", cellX: 3, cellY: 6 },
  ]),
});

export function cloneBuildParts(parts = []) {
  return parts.map((part) => ({ ...part }));
}

export function createStarterRocketBuild() {
  return cloneBuildParts(STARTER_ROCKET.parts);
}
