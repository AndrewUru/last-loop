import test from 'node:test';
import assert from 'node:assert/strict';
import { ROCKETS_BY_ID, evaluateChallenge } from '../src/game/data/rockets.js';
import MissionSystem from '../src/game/systems/MissionSystem.js';

const flight = { success: true, time: 150, fuelPercent: 20, targetsHit: 6, hazardsHit: 0, maxQSpeed: 2 };
const judge = (id, changes) => evaluateChallenge(ROCKETS_BY_ID[id].challenge, { ...flight, ...changes });

test('reaching orbit does not pass a mission with missing parts or rings', () => {
  for (const [id, count] of [['shuttle', 4], ['electron', 5], ['starship', 6]]) {
    assert.equal(judge(id, { targetsHit: count }).completed, true);
    assert.equal(judge(id, { targetsHit: count - 1 }).completed, false);
  }
});

test('debris and excessive Max-Q speed invalidate a successful flight', () => {
  assert.equal(judge('sls', { hazardsHit: 1 }).completed, false);
  assert.equal(judge('ariane-5', { maxQSpeed: 2.05 }).completed, true);
  assert.equal(judge('ariane-5', { maxQSpeed: 2.051 }).completed, false);
});

test('mission time is exclusive and minimum fuel is inclusive', () => {
  assert.equal(judge('starship', { time: 169.99 }).completed, true);
  assert.equal(judge('starship', { time: 170 }).completed, false);
  assert.equal(judge('falcon-9', { fuelPercent: 12 }).completed, true);
  assert.equal(judge('falcon-9', { fuelPercent: 11 }).completed, false);
});

test('only a completed challenge unlocks the next rocket and best scores survive retries', t => {
  const storage = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
  assert.equal(MissionSystem.isUnlocked('energia'), false);
  const missed = MissionSystem.recordFlight({ ...flight, rocketId: 'shuttle', targetsHit: 3 });
  assert.equal(missed.achieved, false);
  assert.equal(MissionSystem.isUnlocked('energia'), false);
  const completed = MissionSystem.recordFlight({ ...flight, rocketId: 'shuttle', targetsHit: 4 });
  assert.equal(completed.unlocked.id, 'energia');
  assert.equal(MissionSystem.isUnlocked('energia'), true);
  assert.equal(MissionSystem.isUnlocked('ariane-5'), false);
  const retry = MissionSystem.recordFlight({ ...flight, rocketId: 'shuttle', time: 180, fuelPercent: 10 });
  assert.equal(retry.completed, false);
  assert.deepEqual(MissionSystem.getBest('shuttle'), { time: 150, fuelPercent: 20 });
  MissionSystem.recordFlight({ ...flight, rocketId: 'shuttle', success: false, time: 10, fuelPercent: 90 });
  assert.deepEqual(MissionSystem.getBest('shuttle'), { time: 150, fuelPercent: 20 });
  assert.equal(MissionSystem.getProgress().completed.length, 1);
});
