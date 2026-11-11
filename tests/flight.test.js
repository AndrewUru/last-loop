import test from 'node:test';
import assert from 'node:assert/strict';
import { ROCKETS, getFlightOptions, getMissionPhases } from '../src/game/data/rockets.js';
import FlightPredictor from '../src/game/systems/FlightPredictor.js';
import FlightSimulator from '../src/game/systems/FlightSimulator.js';
import { buildStages } from '../src/game/systems/Staging.js';

const STEP = 1000 / 30;

// Flies with full throttle along the guidance arrow; `separate` decides when to drop stages.
function fly(rocket, { separate = true, maxSeconds = 600 } = {}) {
  const sim = new FlightSimulator(rocket.stats, getFlightOptions(rocket));
  let s = sim.state;
  for (let i = 0; i < maxSeconds * 30 && !s.result; i += 1) {
    const aligned = s.missionPhase === 0 || Math.abs(s.guidanceError) < 0.2;
    const coast = s.cutEngineCue || !aligned;
    s = sim.update(STEP, {
      engineOn: !coast, throttle: coast ? 0 : 1,
      steer: Math.max(-1, Math.min(1, s.guidanceError * 4)),
      separate: separate && s.separationCue,
    });
  }
  return s;
}

test('every rocket completes its orbital phases with a guidance pilot', () => {
  for (const rocket of ROCKETS) {
    const p = FlightPredictor.predict(rocket.stats, getFlightOptions(rocket));
    assert.equal(p.success, true, `${rocket.id}: ${p.reason}`);
    assert.ok(p.separations >= 1, `${rocket.id} should need at least one separation`);
    assert.equal(p.phaseTimes.length, getMissionPhases(rocket).length - 1, `${rocket.id} phases`);
  }
});

test('no rocket gets through its mission without dropping a stage', () => {
  for (const rocket of ROCKETS) {
    const s = fly(rocket, { separate: false });
    assert.notEqual(s.result, 'success', `${rocket.id} finished on its first stage`);
  }
});

test('missions last longer than the old orbit-only flights', () => {
  const long = ROCKETS.filter(r => r.challenge.goal);
  assert.ok(long.length >= 6);
  for (const rocket of long) {
    const p = FlightPredictor.predict(rocket.stats, getFlightOptions(rocket));
    assert.ok(p.time > 90, `${rocket.id}: ${p.time.toFixed(0)} s`);
  }
});

test('separating drops the empty stage, its mass and switches the burning stage', () => {
  const rocket = ROCKETS.find(r => r.id === 'saturn-v');
  const sim = new FlightSimulator(rocket.stats, getFlightOptions(rocket));
  const s = sim.state;
  s.launched = true;
  const before = sim.model.getCurrentMass(s);
  assert.equal(sim.model.separateStage(s), 0);
  assert.equal(s.stage, 1);
  assert.ok(sim.model.getCurrentMass(s) < before);
  assert.equal(s.fuelRemaining, s.stageFuel[1]);
  assert.equal(s.stageCapacity, sim.model.stages[1].fuel);
  // The last stage cannot be dropped.
  sim.model.separateStage(s);
  assert.equal(sim.model.separateStage(s), -1);
  assert.equal(s.stage, 2);
});

test('an empty stage cues separation and does not count as running out of fuel', () => {
  const rocket = ROCKETS.find(r => r.id === 'falcon-9');
  const sim = new FlightSimulator(rocket.stats, getFlightOptions(rocket));
  let s = sim.state;
  for (let i = 0; i < 30 * 60 && !s.separationCue; i += 1) {
    s = sim.update(STEP, { engineOn: true, throttle: 1, steer: Math.max(-1, Math.min(1, s.guidanceError * 4)) });
  }
  assert.equal(s.separationCue, true);
  assert.ok(s.totalFuel > 1);
  for (let i = 0; i < 30 * 3; i += 1) s = sim.update(STEP, { engineOn: true, throttle: 1 });
  assert.notEqual(s.failure, 'no_fuel');
});

test('single-stage rockets keep their old numbers', () => {
  const stats = { mass: 50, fuel: 120, fuelUse: 1.65, twr: 1.6 };
  const { stages, payloadDry } = buildStages(stats);
  assert.equal(stages.length, 1);
  assert.equal(stages[0].fuel, 120);
  assert.ok(Math.abs(stages[0].thrust - 1.6 * 0.196 * 50) < 1e-9);
  assert.ok(payloadDry > 0);
});

test('flight advances the same time and trajectory at 15, 20, 30, 60 and 144 FPS', () => {
  const rocket = ROCKETS[0];
  const states = [15, 20, 30, 60, 144].map(fps => {
    const sim = new FlightSimulator(rocket.stats, getFlightOptions(rocket));
    for (let frame = 0; frame < fps * 10; frame += 1) {
      sim.update(1000 / fps, { engineOn: true, throttle: 1, steer: 0 });
    }
    assert.ok(Math.abs(sim.state.time - 10) < 1e-8, `${fps} FPS: ${sim.state.time} s`);
    return sim.state;
  });
  for (const state of states.slice(1)) {
    for (const field of ['altitude', 'verticalVelocity', 'fuelRemaining']) {
      assert.ok(Math.abs(state[field] - states[0][field]) < 1e-8, field);
    }
  }
});

test('a separation press drops exactly one stage during a slow frame', () => {
  const rocket = ROCKETS.find(r => r.id === 'saturn-v');
  const sim = new FlightSimulator(rocket.stats, getFlightOptions(rocket));
  Object.assign(sim.state, { launched: true, altitude: 20 });
  sim.update(100, { separate: true });
  assert.equal(sim.state.stage, 1);
  assert.ok(Math.abs(sim.state.time - 0.1) < 1e-8);
});

test('a separation press between physics ticks is kept until the next tick', () => {
  const rocket = ROCKETS.find(r => r.id === 'saturn-v');
  const sim = new FlightSimulator(rocket.stats, getFlightOptions(rocket));
  Object.assign(sim.state, { launched: true, altitude: 20 });
  sim.update(1, { separate: true });
  sim.update(9, { separate: false });
  assert.equal(sim.state.stage, 1);
});

test('a long background stall is bounded and does not leave a catch-up backlog', () => {
  const sim = new FlightSimulator(ROCKETS[0].stats, getFlightOptions(ROCKETS[0]));
  sim.update(60_000);
  assert.ok(Math.abs(sim.state.time - 0.25) < 1e-8);
  sim.update(100);
  assert.ok(Math.abs(sim.state.time - 0.35) < 1e-8);
});
