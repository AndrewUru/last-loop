import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandingState, stepLanding, evaluateLanding, LANDING } from '../src/game/systems/LandingModel.js';

test('an uncontrolled descent crashes and the result is terminal', () => {
  const s = createLandingState();
  for (let i = 0; i < 12000 && !s.result; i++) stepLanding(s, 1 / 120);
  assert.equal(s.result.success, false);
  assert.equal(s.altitude, 0);
  const snapshot = JSON.stringify(s);
  stepLanding(s, 1, { thrust: true });
  assert.equal(JSON.stringify(s), snapshot);
});
test('touchdown requires the whole footprint, safe speeds and angle', () => {
  const safe = { ...createLandingState(), x: 0, vy: -2, vx: 0, angle: 0 };
  assert.equal(evaluateLanding(safe).success, true);
  for (const patch of [{ x: 24 }, { vy: -5 }, { vx: 4 }, { angle: 0.2 }]) {
    assert.equal(evaluateLanding({ ...safe, ...patch }).success, false);
  }
});
test('empty fuel produces no thrust and never becomes negative', () => {
  const s = { ...createLandingState(), fuelRemaining: 0.001 };
  stepLanding(s, 1 / 120, { thrust: true });
  assert.equal(s.fuelRemaining, 0);
  stepLanding(s, 1 / 120, { thrust: true });
  assert.equal(s.engineOn, false);
});
test('a braking strategy can land within the fuel budget', () => {
  const s = createLandingState();
  for (let i = 0; i < 12000 && !s.result; i++) {
    const targetSpeed = -Math.min(20, Math.sqrt(2 * 2.5 * Math.max(0, s.altitude - 2)) + 1);
    stepLanding(s, 1 / 120, { thrust: s.vy < targetSpeed });
  }
  assert.equal(s.result?.success, true);
  assert.ok(s.fuelRemaining > 0);
  assert.ok(s.time > 20 && s.time < 60);
  assert.ok(s.result.score > 0 && s.result.score <= 1000);
});
test('leaving the training zone ends the attempt', () => {
  const s = { ...createLandingState(), x: 451 };
  stepLanding(s, 1 / 120);
  assert.equal(s.result.success, false);
});
test('partial fuel burns apply only the remaining impulse', () => {
  const s = { ...createLandingState(), fuelRemaining: 0.002 };
  const vy = s.vy;
  stepLanding(s, 0.01, { thrust: true });
  assert.ok(Math.abs(s.vy - (vy + LANDING.thrust * 0.002 - LANDING.gravity * 0.01)) < 1e-10);
});
test('touchdown interpolation rejects crossing the pad at high lateral speed', () => {
  const s = { ...createLandingState(), x: -40, altitude: 0.01, vx: 50, vy: -1 };
  stepLanding(s, 0.5);
  assert.equal(s.result.success, false);
  assert.ok(s.x < -39);
});

import {
  LANDING_LEVELS, getLandingLevel, getMedal, isLevelUnlocked, readLandingProgress, recordLanding, getLandingTip,
} from '../src/game/systems/LandingModel.js';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
};
const brake = (s, level) => {
  for (let i = 0; i < 12000 && !s.result; i++) {
    const targetSpeed = -Math.min(20, Math.sqrt(2 * 2.5 * Math.max(0, s.altitude - 2)) + 1);
    // Steer towards the pad, cancelling drift relative to it.
    const err = s.altitude < 20 ? -(s.vx - s.padVx) * 0.3 : (s.padX - s.x) * 0.02 - (s.vx - s.padVx) * 0.3;
    stepLanding(s, 1 / 120, { thrust: s.vy < targetSpeed, steer: Math.max(-1, Math.min(1, err * 4 - s.angle * 6)) }, level);
  }
  return s;
};

test('every mission level can be landed by a simple autopilot', () => {
  for (const level of LANDING_LEVELS) {
    let wins = 0;
    for (let seed = 0; seed < 10; seed++) {
      let n = seed * 9301 + 49297;
      const rng = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
      if (brake(createLandingState(level, rng), level).result.success) wins++;
    }
    assert.ok(wins >= 6, `${level.id}: ${wins}/10`);
  }
});
test('on the droneship, landing is judged against the moving deck', () => {
  const ship = { ...createLandingState(), padX: 20, padVx: 3, vx: 3, vy: -2 };
  ship.x = 20;
  assert.equal(evaluateLanding(ship).success, true);
  assert.equal(evaluateLanding({ ...ship, x: -5 }).success, false);
  assert.equal(evaluateLanding({ ...ship, vx: -1 }).success, false);
});
test('progress unlocks the next level and keeps the best score with its ghost', () => {
  const storage = memoryStorage();
  assert.equal(isLevelUnlocked(readLandingProgress(storage), 'crosswind'), false);
  recordLanding('pad', { success: true, score: 700 }, [[0, 0, 600, 0]], storage);
  recordLanding('pad', { success: true, score: 500 }, [[1, 1, 1, 0]], storage);
  const progress = readLandingProgress(storage);
  assert.equal(progress.best.pad, 700);
  assert.deepEqual(progress.ghosts.pad, [[0, 0, 600, 0]]);
  assert.equal(isLevelUnlocked(progress, 'crosswind'), true);
  assert.equal(isLevelUnlocked(progress, 'droneship'), false);
});
test('medals, level lookup and tips', () => {
  assert.equal(getMedal(900).id, 'gold');
  assert.equal(getMedal(700).id, 'silver');
  assert.equal(getMedal(10).id, 'bronze');
  assert.equal(getLandingLevel('nope').id, 'pad');
  const s = { ...createLandingState(), vy: -9, fuelRemaining: 5 };
  s.result = evaluateLanding({ ...s, altitude: 0 });
  assert.match(getLandingTip(s, null), /No encendiste/);
});
