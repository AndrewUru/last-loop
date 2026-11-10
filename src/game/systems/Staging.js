// Turns a rocket's stage list into the numbers the flight model uses.
//
// A rocket's `stages` (in rockets.js) go from the bottom of the stack to the
// top; the first one burns first and is the first to be dropped. Each takes:
//   fuel   share of the rocket's total fuel
//   dry    share of its empty mass (the rest is the payload, never dropped)
//   twr    thrust-to-weight at its ignition, against everything still
//          attached; the first stage uses the rocket's liftoff twr instead
//   time   seconds the stage burns at full throttle. This is what limits a
//          stage in this world (thrust is generous), so it decides how far
//          each stage gets you; without it the rocket's burn rate is used
// Without a list the rocket is a single stage, as before staging existed.

const GRAVITY = 0.196;
const FUEL_BURN_SCALE = 1.1;
const MAX_FUEL_MASS_FACTOR = 0.16;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getFuelMassFactor(stats) {
  return stats.fuel > 0 ? clamp((stats.mass * 0.54) / Math.max(stats.fuel, 1), 0.06, MAX_FUEL_MASS_FACTOR) : 0;
}

export function buildStages(stats, defs = null) {
  const fuelMassFactor = getFuelMassFactor(stats);
  const totalDry = Math.max(1, stats.mass - stats.fuel * fuelMassFactor);
  const baseBurn = Math.max(0.2, (stats.fuelUse || 0) * FUEL_BURN_SCALE);
  const list = defs && defs.length ? defs : [{ fuel: 1, dry: 0 }];

  const stages = list.map((def) => ({
    name: def.name || "Etapa",
    kind: def.kind || "core",
    fuel: stats.fuel * def.fuel,
    dry: totalDry * (def.dry || 0),
    burnRate: def.time ? (stats.fuel * def.fuel) / def.time : baseBurn,
    twr: def.twr,
    thrust: 0,
  }));
  const payloadDry = Math.max(0.5, totalDry * (1 - list.reduce((sum, def) => sum + (def.dry || 0), 0)));

  // Thrust from each stage's ignition twr against the full stack above it.
  stages.forEach((stage, index) => {
    const stackMass =
      payloadDry + stages.slice(index).reduce((sum, s) => sum + s.dry + s.fuel * fuelMassFactor, 0);
    const twr = index === 0 ? stats.twr || 0 : stage.twr ?? 1;
    stage.thrust = twr * GRAVITY * stackMass;
  });

  return { stages, payloadDry, fuelMassFactor };
}
