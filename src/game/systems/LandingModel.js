// Metres, seconds and radians. Independent from rendering and orbital progression.
export const LANDING = Object.freeze({
  gravity: 1.6, thrust: 4.8, fuel: 22, startHeight: 600,
  padHalfWidth: 32, legHalfWidth: 9, maxVerticalSpeed: 4,
  maxHorizontalSpeed: 3, maxAngle: 10 * Math.PI / 180,
  turnRate: 0.65, maxTilt: Math.PI / 6, timeout: 90,
});
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export function createLandingState() {
  return { x: 0, altitude: LANDING.startHeight, vx: 0, vy: -18,
    angle: 0, fuelRemaining: LANDING.fuel, time: 0, engineOn: false, result: null };
}

export function evaluateLanding(s) {
  const precision = Math.abs(s.x);
  let reason = '';
  if (precision + LANDING.legHalfWidth > LANDING.padHalfWidth) reason = 'Has caído fuera de la plataforma.';
  else if (Math.abs(s.vy) > LANDING.maxVerticalSpeed) reason = 'Frena antes: la velocidad vertical era demasiado alta.';
  else if (Math.abs(s.vx) > LANDING.maxHorizontalSpeed) reason = 'Reduce el desplazamiento lateral antes de tocar.';
  else if (Math.abs(s.angle) > LANDING.maxAngle) reason = 'Endereza el propulsor antes de tocar.';
  const parts = {
    precision: Math.round(400 * clamp(1 - precision / (LANDING.padHalfWidth - LANDING.legHalfWidth), 0, 1)),
    softness: Math.round(400 * clamp(1 - Math.hypot(s.vx, s.vy) / 5, 0, 1)),
    fuel: Math.round(200 * clamp(s.fuelRemaining / LANDING.fuel, 0, 1)),
  };
  return { success: !reason, reason, score: reason ? 0 : Object.values(parts).reduce((a, b) => a + b, 0), parts };
}

export function stepLanding(s, dt, controls = {}) {
  if (s.result) return s;
  s.time += dt;
  s.angle = clamp(s.angle + clamp(controls.steer || 0, -1, 1) * LANDING.turnRate * dt, -LANDING.maxTilt, LANDING.maxTilt);
  const burn = controls.thrust ? Math.min(dt, s.fuelRemaining) : 0;
  s.engineOn = burn > 0;
  s.fuelRemaining = Math.max(0, s.fuelRemaining - burn);
  s.vx += Math.sin(s.angle) * LANDING.thrust * burn;
  s.vy += Math.cos(s.angle) * LANDING.thrust * burn - LANDING.gravity * dt;
  const oldHeight = s.altitude;
  const nextHeight = oldHeight + s.vy * dt;
  // Evaluate at contact, so a fast step cannot tunnel across the landing pad.
  const fraction = nextHeight <= 0 ? clamp(oldHeight / (oldHeight - nextHeight), 0, 1) : 1;
  s.x += s.vx * dt * fraction;
  s.altitude = Math.max(0, nextHeight);
  if (nextHeight <= 0) s.result = evaluateLanding(s);
  else if (Math.abs(s.x) > 450 || s.altitude > 1000 || s.time >= LANDING.timeout) {
    s.result = { success: false, reason: 'Fuera de la zona de entrenamiento. Inténtalo de nuevo.', score: 0 };
  }
  if (s.result) s.engineOn = false;
  return s;
}
