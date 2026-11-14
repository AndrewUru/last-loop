import test from 'node:test';
import assert from 'node:assert/strict';
import { ROCKETS_BY_ID, evaluateChallenge } from '../src/game/data/rockets.js';
import MissionSystem from '../src/game/systems/MissionSystem.js';
import { applySingleBurn, createSingleBurnRule } from '../src/game/systems/SingleBurn.js';

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

test('a flight that misses several objectives reports every one of them', () => {
  const outcome = judge('starship', { targetsHit: 4, time: 180 });
  assert.equal(outcome.completed, false);
  assert.equal(outcome.missedAll.length, 2);
  assert.equal(outcome.missed, outcome.missedAll[0]);
  assert.deepEqual(judge('starship', {}).missedAll, []);
  assert.deepEqual(judge('starship', { success: false }).missedAll, []);
});

test('single burn: a stage locks only after it has burned, never right after a separation', () => {
  const rule = createSingleBurnRule();
  const state = { launched: false, missionPhase: 0, stage: 0, fuelRemaining: 100 };

  // Letting go on the pad does not count.
  assert.equal(applySingleBurn(rule, state, true), true);
  assert.equal(applySingleBurn(rule, state, false), false);
  assert.equal(rule.engineLocked, false);

  state.launched = true;
  assert.equal(applySingleBurn(rule, state, true), true);

  // The stage runs dry; the pilot lets go to press "separate".
  state.fuelRemaining = 0;
  applySingleBurn(rule, state, false);
  assert.equal(rule.engineLocked, false);

  // New stage, thrust not pressed yet: it must wait, not lock.
  state.stage = 1;
  state.fuelRemaining = 80;
  assert.equal(applySingleBurn(rule, state, false), false);
  assert.equal(applySingleBurn(rule, state, false), false);
  assert.equal(rule.engineLocked, false);
  assert.equal(applySingleBurn(rule, state, true), true);

  // Letting go while it burns is the one thing that locks it...
  assert.equal(applySingleBurn(rule, state, false), false);
  assert.equal(rule.engineLocked, true);
  assert.equal(applySingleBurn(rule, state, true), false);

  // ...until the stage is dropped, and after orbit the engine is free.
  state.stage = 2;
  state.fuelRemaining = 40;
  assert.equal(applySingleBurn(rule, state, true), true);
  applySingleBurn(rule, state, false);
  assert.equal(rule.engineLocked, true);
  state.missionPhase = 1;
  assert.equal(applySingleBurn(rule, state, true), true);
  assert.equal(rule.engineLocked, false);
});
