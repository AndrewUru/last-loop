// Metres, seconds and radians. Independent from rendering and orbital progression.
export const LANDING = Object.freeze({
  gravity: 1.6, thrust: 4.8, fuel: 22, startHeight: 600,
  padHalfWidth: 32, legHalfWidth: 9, maxVerticalSpeed: 4,
  maxHorizontalSpeed: 3, maxAngle: 10 * Math.PI / 180,
  turnRate: 0.65, turnResponse: 8, maxTilt: Math.PI / 6, timeout: 90,
  zoneHalfWidth: 450,
});

// The landing mission: three recoveries, each unlocked by landing the one before.
// start.x / start.vx are ranges ([min, max]) picked at random per attempt.
export const LANDING_LEVELS = Object.freeze([
  {
    id: 'pad',
    title: 'Zona de aterrizaje',
    place: 'Cabo Cañaveral · tierra firme',
    briefing: 'Cielo despejado y sin viento.\nAprende a encender el motor en el momento justo.',
    surface: 'land', sky: 'day', backdrop: 'landing-pad-backdrop',
    fuel: 22, start: { x: [-60, 60], vx: [-2, 2], vy: -18 },
    wind: 0, ship: null,
  },
  {
    id: 'crosswind',
    title: 'Viento cruzado',
    place: 'Vandenberg · costa del Pacífico',
    briefing: 'Ráfagas laterales empujan el propulsor.\nInclínalo contra el viento para mantenerte centrado.',
    surface: 'land', sky: 'dusk', backdrop: 'landing-crosswind-backdrop',
    fuel: 20, start: { x: [-120, 120], vx: [-5, 5], vy: -20 },
    wind: 0.55, ship: null,
  },
  {
    id: 'droneship',
    title: 'Barcaza en alta mar',
    place: 'Atlántico · 600 km de la costa',
    briefing: 'La plataforma flota y se mueve con el oleaje.\nAterriza sobre la cubierta, no donde estaba.',
    surface: 'sea', sky: 'night', backdrop: 'landing-droneship-backdrop',
    fuel: 18, start: { x: [-90, 90], vx: [-4, 4], vy: -20 },
    wind: 0.3, ship: { amplitude: 6, period: 20, roll: 2.5 * Math.PI / 180 },
  },
]);

export const LANDING_MEDALS = Object.freeze([
  { id: 'gold', label: 'ORO', min: 850, color: 0xffd166 },
  { id: 'silver', label: 'PLATA', min: 650, color: 0xd5e1ea },
  { id: 'bronze', label: 'BRONCE', min: 0, color: 0xd08b5b },
]);

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const pick = ([min, max], rng) => min + (max - min) * rng();

export function getLandingLevel(id) {
  return LANDING_LEVELS.find(level => level.id === id) || LANDING_LEVELS[0];
}

export function getMedal(score) {
  return LANDING_MEDALS.find(medal => score >= medal.min) || null;
}

// Without a level the attempt is the original deterministic drill.
export function createLandingState(level = null, rng = Math.random) {
  const fuel = level?.fuel ?? LANDING.fuel;
  return {
    x: level ? pick(level.start.x, rng) : 0,
    altitude: LANDING.startHeight,
    vx: level ? pick(level.start.vx, rng) : 0,
    vy: level?.start.vy ?? -18,
    angle: 0, turn: 0,
    fuel, fuelRemaining: fuel, time: 0, engineOn: false,
    padX: 0, padVx: 0, padRoll: 0, wind: 0,
    windPhase: rng() * Math.PI * 2,
    result: null,
  };
}

export function evaluateLanding(s) {
  const fuel = s.fuel ?? LANDING.fuel;
  const offset = Math.abs(s.x - (s.padX || 0));
  const relativeVx = s.vx - (s.padVx || 0);
  const tilt = Math.abs(s.angle - (s.padRoll || 0));
  let reason = '';
  if (offset + LANDING.legHalfWidth > LANDING.padHalfWidth) reason = 'Has caído fuera de la plataforma.';
  else if (Math.abs(s.vy) > LANDING.maxVerticalSpeed) reason = 'Frena antes: la velocidad vertical era demasiado alta.';
  else if (Math.abs(relativeVx) > LANDING.maxHorizontalSpeed) reason = 'Reduce el desplazamiento lateral antes de tocar.';
  else if (tilt > LANDING.maxAngle) reason = 'Endereza el propulsor antes de tocar.';
  const parts = {
    precision: Math.round(400 * clamp(1 - offset / (LANDING.padHalfWidth - LANDING.legHalfWidth), 0, 1)),
    softness: Math.round(400 * clamp(1 - Math.hypot(relativeVx, s.vy) / 5, 0, 1)),
    fuel: Math.round(200 * clamp(s.fuelRemaining / fuel, 0, 1)),
  };
  const score = reason ? 0 : Object.values(parts).reduce((a, b) => a + b, 0);
  return { success: !reason, reason, score, parts, medal: reason ? null : getMedal(score)?.id ?? null };
}

// Height at which a full burn, started now, stops the descent.
export function getStoppingHeight(s) {
  const deceleration = LANDING.thrust * Math.cos(s.angle) - LANDING.gravity;
  return s.vy < 0 && deceleration > 0 ? (s.vy * s.vy) / (2 * deceleration) : 0;
}

// Where the booster would touch down coasting from here (engine off).
export function predictTouchdownX(s) {
  const g = LANDING.gravity;
  const t = (s.vy + Math.sqrt(s.vy * s.vy + 2 * g * s.altitude)) / g;
  return s.x + s.vx * t;
}

function updateEnvironment(s, level) {
  const ship = level?.ship;
  if (ship) {
    const w = (Math.PI * 2) / ship.period;
    s.padX = ship.amplitude * Math.sin(s.time * w);
    s.padVx = ship.amplitude * w * Math.cos(s.time * w);
    s.padRoll = ship.roll * Math.sin(s.time * w * 1.7 + 0.6);
  }
  const strength = level?.wind || 0;
  // Gusts fade near the ground, where the booster is shielded.
  const shelter = clamp(s.altitude / 120, 0.25, 1);
  s.wind = strength * shelter *
    (Math.sin(s.time * 0.31 + s.windPhase) + 0.55 * Math.sin(s.time * 1.13 + s.windPhase * 2));
}

export function stepLanding(s, dt, controls = {}, level = null) {
  if (s.result) return s;
  s.time += dt;
  updateEnvironment(s, level);
  // The steering builds up quickly instead of snapping to full rate.
  s.turn = (s.turn ?? 0) + (clamp(controls.steer || 0, -1, 1) - (s.turn ?? 0)) * Math.min(1, dt * LANDING.turnResponse);
  s.angle = clamp(s.angle + s.turn * LANDING.turnRate * dt, -LANDING.maxTilt, LANDING.maxTilt);
  const burn = controls.thrust ? Math.min(dt, s.fuelRemaining) : 0;
  s.engineOn = burn > 0;
  s.fuelRemaining = Math.max(0, s.fuelRemaining - burn);
  s.vx += Math.sin(s.angle) * LANDING.thrust * burn + s.wind * dt;
  s.vy += Math.cos(s.angle) * LANDING.thrust * burn - LANDING.gravity * dt;
  const oldHeight = s.altitude;
  const nextHeight = oldHeight + s.vy * dt;
  // Evaluate at contact, so a fast step cannot tunnel across the landing pad.
  const fraction = nextHeight <= 0 ? clamp(oldHeight / (oldHeight - nextHeight), 0, 1) : 1;
  s.x += s.vx * dt * fraction;
  s.altitude = Math.max(0, nextHeight);
  if (nextHeight <= 0) s.result = evaluateLanding(s);
  else if (Math.abs(s.x) > LANDING.zoneHalfWidth || s.altitude > 1000 || s.time >= LANDING.timeout) {
    s.result = {
      success: false, reason: 'Fuera de la zona de entrenamiento. Inténtalo de nuevo.', score: 0,
      parts: { precision: 0, softness: 0, fuel: 0 }, medal: null,
    };
  }
  if (s.result) s.engineOn = false;
  return s;
}

// ---------- progress ----------

const PROGRESS_KEY = 'last-loop-landing-v2';
const LEGACY_BEST_KEY = 'last-loop-landing-best-v1';

export function readLandingProgress(storage = globalThis.localStorage) {
  let data = null;
  try {
    data = JSON.parse(storage?.getItem(PROGRESS_KEY));
  } catch { /* corrupt or unavailable */ }
  if (!data || typeof data !== 'object') {
    data = { best: {}, ghosts: {} };
    try {
      const legacy = Number(storage?.getItem(LEGACY_BEST_KEY)) || 0;
      if (legacy > 0) data.best.pad = legacy;
    } catch { /* ignore */ }
  }
  return { best: data.best || {}, ghosts: data.ghosts || {} };
}

export function isLevelUnlocked(progress, levelId) {
  const index = LANDING_LEVELS.findIndex(level => level.id === levelId);
  return index <= 0 || (progress.best[LANDING_LEVELS[index - 1].id] || 0) > 0;
}

// Saves a successful attempt; the ghost (trajectory samples) is kept for the best one.
export function recordLanding(levelId, result, ghost, storage = globalThis.localStorage) {
  const progress = readLandingProgress(storage);
  const previous = progress.best[levelId] || 0;
  const improved = result.success && result.score > previous;
  if (improved) {
    progress.best[levelId] = result.score;
    progress.ghosts[levelId] = ghost;
    try {
      storage?.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch { /* progress just won't persist */ }
  }
  return { progress, improved, previous };
}

// One concrete tip after a failed (or poor) attempt.
export function getLandingTip(s, burnStartAltitude) {
  const r = s.result;
  if (!r) return '';
  if (r.success) {
    if (r.parts.precision < 250) return 'Corrige la deriva lateral antes: arriba cuesta menos combustible.';
    if (r.parts.softness < 250) return 'Alarga el encendido final para tocar más suave.';
    if (r.parts.fuel < 80) return 'Enciende más tarde y de una vez: el encendido corto gasta menos.';
    return '¡Vuelo de manual!';
  }
  if (s.fuelRemaining <= 0.01) return 'Te quedaste sin combustible: no frenes arriba, guarda el motor para el final.';
  if (Math.abs(s.vy) > LANDING.maxVerticalSpeed) {
    return burnStartAltitude == null
      ? 'No encendiste el motor. Enciéndelo cuando el propulsor cruce la línea naranja.'
      : `Encendiste a ${Math.round(burnStartAltitude)} m: hazlo antes, al cruzar la línea naranja.`;
  }
  if (r.reason.includes('plataforma')) return 'Mira la marca de caída en el suelo e inclínate hasta que caiga sobre la plataforma.';
  if (r.reason.includes('lateral')) return 'Antes de tocar, inclínate al lado contrario de la deriva hasta frenarla.';
  if (r.reason.includes('Endereza')) return 'En los últimos metros suelta la inclinación y deja el propulsor vertical.';
  return 'Mantente dentro de la zona y baja hacia la plataforma.';
}
