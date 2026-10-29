import Phaser from "phaser";
import FlightSimulator from "../../systems/FlightSimulator.js";
import { FIRE_POOL_SIZE, SMOKE_POOL_SIZE } from "./FlightSceneConstants.js";

function createParticlePool(size) {
  return Array.from({ length: size }, () => ({}));
}

function createFlightKeys(input) {
  return input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.UP,
    left: Phaser.Input.Keyboard.KeyCodes.LEFT,
    right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    w: Phaser.Input.Keyboard.KeyCodes.W,
    a: Phaser.Input.Keyboard.KeyCodes.A,
    d: Phaser.Input.Keyboard.KeyCodes.D,
    space: Phaser.Input.Keyboard.KeyCodes.SPACE,
  });
}

export function createFlightRuntimeState(input, stats) {
  return {
    simulator: new FlightSimulator(stats),
    finished: false,
    resultOverlayVisible: false,
    lastPhaseId: null,
    maxAltitude: 0,
    flightTrail: [],
    smokeParticles: [],
    fireParticles: [],
    smokeParticlePool: createParticlePool(SMOKE_POOL_SIZE),
    fireParticlePool: createParticlePool(FIRE_POOL_SIZE),
    controls: { engineOn: false, throttle: 0, steer: 0 },
    touchControls: { steerLeft: false, steerRight: false, thrust: false },
    cameraState: { initialized: false, x: 0, y: 0, zoom: 1 },
    keys: createFlightKeys(input),
    sonicBoomPlayed: false,
    lastWhooshAlt: null,
  };
}
