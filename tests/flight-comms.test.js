import test from 'node:test';
import assert from 'node:assert/strict';
import { AiClient } from '../src/game/ai/AiClient.js';
import { flightSceneCommsMethods } from '../src/game/scenes/flight/FlightSceneComms.js';
import { ROCKETS } from '../src/game/data/rockets.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('a late briefing cannot transmit into a restarted flight', async t => {
  const requestStarted = deferred();
  const reply = deferred();
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ results: [] }) }));
  t.mock.method(AiClient, 'ask', () => {
    requestStarted.resolve();
    return reply.promise;
  });
  let transmissions = 0;
  const makeControl = () => ({ closed: false, transmit: () => { transmissions++; }, report: () => { transmissions++; } });
  const scene = {
    rocketDef: ROCKETS[0], missionControl: makeControl(),
    simulator: { state: { altitude: 0 } }, finished: false,
  };
  const pending = flightSceneCommsMethods.startBriefing.call(scene);
  await requestStarted.promise;
  scene.missionControl.closed = true;
  scene.missionControl = makeControl();
  reply.resolve({ text: 'Briefing del intento anterior' });
  await pending;
  assert.equal(transmissions, 0);
});

test('a late debrief cannot overwrite the next flight result', async t => {
  const reply = deferred();
  t.mock.method(AiClient, 'ask', () => reply.promise);
  const updates = [];
  const scene = {
    missionControl: { closed: false, report() {} }, rocketDef: ROCKETS[0],
    getTelemetry: () => ({}), flightLog: { separations: [], maxQSpeed: 0 },
    resultOverlayVisible: true, setDebrief: text => updates.push(text),
  };
  const pending = flightSceneCommsMethods.finishComms.call(scene,
    { missionPhase: 0 }, { success: true, time: 80, maxAltitude: 170 });
  scene.missionControl.closed = true;
  scene.missionControl = { closed: false, report() {} };
  reply.resolve({ text: 'Informe del intento anterior' });
  await pending;
  assert.deepEqual(updates, ['Analizando telemetría…']);
});
