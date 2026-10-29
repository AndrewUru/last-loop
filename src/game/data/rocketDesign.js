import { PARTS_BY_ID } from "./parts.js";

const DESIGN_KEY = "last-loop-design";
const COLUMN_X = 11;
const TOP_Y = 2;

// What the hangar lets you pick, in the order the parts stack from the nose
// down. The capsule is always there; boosters come in pairs on the sides.
export const DESIGN_SLOTS = [
  { partId: "nose_cone", label: "Ojiva", effect: "-30% rozamiento · 1 t", max: 1 },
  { partId: "avionics_ring", label: "Anillo de control", effect: "Gira un 36% más rápido · 5 t", max: 1 },
  { partId: "fuel_tank_large", label: "Tanque grande", effect: "+110 combustible · 28 t", max: 4 },
  { partId: "fuel_tank_small", label: "Tanque pequeño", effect: "+62 combustible · 18 t", max: 4 },
  { partId: "engine_main", label: "Motor", effect: "Empuje 58 · 14 t", max: 1 },
  {
    partId: "solid_booster",
    label: "Boosters laterales",
    effect: "+190 empuje, +170 combustible · 64 t",
    max: 1,
    perStep: 2,
  },
];

export const STARTER_DESIGN = Object.freeze({ fuel_tank_large: 1, engine_main: 1 });

export function normalizeDesign(design = {}) {
  const normalized = {};
  DESIGN_SLOTS.forEach((slot) => {
    const count = Math.round(Number(design[slot.partId]) || 0);
    normalized[slot.partId] = Math.min(Math.max(count, 0), slot.max);
  });
  return normalized;
}

// Lays the design out as grid parts so the stats calculator and the flight
// scene can keep working with cell positions.
export function designToBuild(design) {
  const counts = normalizeDesign(design);
  const parts = [];
  let y = TOP_Y;
  const stack = (partId, times = 1) => {
    for (let i = 0; i < times; i += 1) {
      parts.push({ partId, cellX: COLUMN_X, cellY: y });
      y += PARTS_BY_ID[partId].gridHeight;
    }
  };

  stack("nose_cone", counts.nose_cone);
  stack("capsule");
  stack("avionics_ring", counts.avionics_ring);
  stack("fuel_tank_large", counts.fuel_tank_large);
  stack("fuel_tank_small", counts.fuel_tank_small);
  stack("engine_main", counts.engine_main);

  if (counts.solid_booster > 0) {
    const boosterTop = y - PARTS_BY_ID.solid_booster.gridHeight;
    parts.push({ partId: "solid_booster", cellX: COLUMN_X - 1, cellY: boosterTop, side: -1 });
    parts.push({ partId: "solid_booster", cellX: COLUMN_X + 1, cellY: boosterTop, side: 1 });
  }

  return parts;
}

export function buildToDesign(build = []) {
  const counts = {};
  build.forEach((part) => {
    counts[part.partId] = (counts[part.partId] || 0) + 1;
  });
  counts.solid_booster = Math.floor((counts.solid_booster || 0) / 2);
  return normalizeDesign(counts);
}

export function loadSavedDesign() {
  try {
    const saved = JSON.parse(localStorage.getItem(DESIGN_KEY));
    if (saved && typeof saved === "object") {
      return normalizeDesign(saved);
    }
  } catch (error) {
    // Fall back to the starter rocket.
  }
  return normalizeDesign(STARTER_DESIGN);
}

export function saveDesign(design) {
  try {
    localStorage.setItem(DESIGN_KEY, JSON.stringify(normalizeDesign(design)));
  } catch (error) {
    // Design just won't persist between visits.
  }
}
