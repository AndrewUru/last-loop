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
