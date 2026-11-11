import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightRuntimeState } from '../src/game/scenes/flight/FlightSceneState.js';
import { ROCKETS, getFlightOptions } from '../src/game/data/rockets.js';

test('reusing a scene after high orbit starts a fresh flight and camera', () => {
  const input = { keyboard: { addKeys: keys => keys } };
  const rocket = ROCKETS.find(r => r.id === 'saturn-v');
  const fresh = () => createFlightRuntimeState(input, rocket.stats, getFlightOptions(rocket));
  const scene = fresh();
  const oldSimulator = scene.simulator;
  Object.assign(scene, {
    lastMissionPhase: 1, phaseShot: 1, orbitShot: 1,
    finished: true, resultOverlayVisible: true,
    zoomLabel: { active: false }, zoomLabelValue: 4,
  });
  scene.controls.engineOn = true;
  scene.touchControls.separate = true;
  scene.flightTrail.push({ x: 10, y: 20 });

  // Phaser reuses the Scene instance; initializeState assigns over it.
  Object.assign(scene, fresh());

  assert.notEqual(scene.simulator, oldSimulator);
  assert.equal(scene.lastMissionPhase, scene.simulator.state.missionPhase);
  assert.equal(scene.phaseShot, 0);
  assert.equal(scene.orbitShot, 0);
  assert.equal(scene.zoomLabel, null);
  assert.equal(scene.zoomLabelValue, 1);
  assert.equal(scene.finished, false);
  assert.equal(scene.resultOverlayVisible, false);
  assert.equal(scene.controls.engineOn, false);
  assert.equal(scene.touchControls.separate, false);
  assert.equal(scene.flightTrail.length, 0);
});
