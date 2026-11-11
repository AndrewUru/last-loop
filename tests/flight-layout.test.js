import test from 'node:test';
import assert from 'node:assert/strict';
import { ROCKETS, getFlightOptions } from '../src/game/data/rockets.js';
import FlightPredictor from '../src/game/systems/FlightPredictor.js';
import { FLIGHT_WORLD } from '../src/game/systems/FlightSimulator.js';
import { getRingRadius, getRingVisibility, placeAlongClimb } from '../src/game/scenes/flight/FlightMissionLayout.js';
import { getGroundReveal, toRenderSpace } from '../src/game/scenes/flight/FlightSceneUtils.js';
import { ROCKET_CELL_SIZE, PAD_FADE_END } from '../src/game/scenes/flight/FlightSceneConstants.js';

test('mission paths include the coast to first orbit, without continuing into later phases', () => {
  for (const rocket of ROCKETS.filter(r => r.challenge.targets || r.challenge.hazards)) {
    const path = FlightPredictor.tracePath(rocket.stats, getFlightOptions(rocket));
    assert.ok(path.at(-1).altitude >= FLIGHT_WORLD.orbitMinAltitude, rocket.id);
    assert.ok(path.at(-1).altitude < 200, rocket.id);
  }
});

for (const rocket of ROCKETS.filter(r => r.challenge.targets?.kind === 'rings')) {
  test(`${rocket.id}: hoops are separated, reachable and absent over the launch pad`, () => {
    const path = FlightPredictor.tracePath(rocket.stats, getFlightOptions(rocket));
    const height = rocket.height * ROCKET_CELL_SIZE;
    const radius = getRingRadius(height);
    const targets = placeAlongClimb(path, rocket.challenge.targets.count, 0.12, 0.88, radius * 0.55, height / 2);
    assert.equal(targets.length, rocket.challenge.targets.count);
    const centres = path.map(sample => {
      const base = toRenderSpace(sample.position);
      return { x: base.x + Math.cos(sample.orientation) * height / 2, y: base.y + Math.sin(sample.orientation) * height / 2 };
    });
    targets.forEach((target, index) => {
      assert.equal(getRingVisibility(0, target.altitude), 0);
      assert.equal(getRingVisibility(3, target.altitude), 0);
      assert.equal(getRingVisibility(target.altitude - 20, target.altitude), 1);
      // The guidance trajectory still passes through each hoop's opening.
      const closest = Math.min(...centres.map(point => Math.hypot(point.x - target.x, point.y - target.y)));
      assert.ok(closest < radius * 0.8, `${index}: unreachable hoop`);
      for (const previous of targets.slice(0, index)) {
        assert.ok(Math.hypot(target.x - previous.x, target.y - previous.y) > radius * 2.5, `${index}: overlapping hoops`);
      }
    });
  });
}

test('the horizon remains flat through tower clearance and bends gradually at altitude', () => {
  for (let altitude = 0; altitude <= PAD_FADE_END; altitude += 0.25) {
    assert.equal(getGroundReveal(altitude), 0);
  }
  assert.equal(getGroundReveal(3), 0); // Screenshot regression: early curved ground wedge.
  let previous = 0;
  for (let altitude = 0; altitude <= 100; altitude += 0.5) {
    const reveal = getGroundReveal(altitude);
    assert.ok(reveal >= previous && reveal - previous < 0.02);
    previous = reveal;
  }
  assert.equal(previous, 1);
});
