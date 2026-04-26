import Phaser from "phaser";
import FlightSimulator, { FLIGHT_WORLD } from "../../systems/FlightSimulator.js";
import {
  FIRE_POOL_SIZE,
  INITIAL_CAMERA_ZOOM,
  LAUNCH_CAMERA_CENTER_OFFSET,
  SMOKE_POOL_SIZE,
} from "./FlightSceneConstants.js";

function createParticlePool(size) {
  return Array.from({ length: size }, () => ({}));
}

function createFlightControls() {
  return {
    throttle: 0,
    cruiseThrottle: 0.85,
    steer: 0,
    assistEnabled: true,
    engineOn: false,
    source: "Pilot",
  };
}

function createFlightCameraState() {
  return {
    centerX: 0,
    centerY: -FLIGHT_WORLD.planetRadius + LAUNCH_CAMERA_CENTER_OFFSET,
    zoom: INITIAL_CAMERA_ZOOM,
    panX: 0,
    panY: 0,
    zoomFactor: 1,
  };
}

function createFlightKeys(input) {
  return input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.UP,
    down: Phaser.Input.Keyboard.KeyCodes.DOWN,
    left: Phaser.Input.Keyboard.KeyCodes.LEFT,
    right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    w: Phaser.Input.Keyboard.KeyCodes.W,
    a: Phaser.Input.Keyboard.KeyCodes.A,
    s: Phaser.Input.Keyboard.KeyCodes.S,
    d: Phaser.Input.Keyboard.KeyCodes.D,
    f: Phaser.Input.Keyboard.KeyCodes.F,
    g: Phaser.Input.Keyboard.KeyCodes.G,
    h: Phaser.Input.Keyboard.KeyCodes.H,
    zero: Phaser.Input.Keyboard.KeyCodes.ZERO,
    one: Phaser.Input.Keyboard.KeyCodes.ONE,
    two: Phaser.Input.Keyboard.KeyCodes.TWO,
    three: Phaser.Input.Keyboard.KeyCodes.THREE,
    four: Phaser.Input.Keyboard.KeyCodes.FOUR,
    space: Phaser.Input.Keyboard.KeyCodes.SPACE,
    shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
  });
}

export function createFlightRuntimeState(input, stats) {
  return {
    simulator: new FlightSimulator(stats),
    finished: false,
    resultOverlayVisible: false,
    launchBurstPlayed: false,
    lastPhaseId: null,
    flightTrail: [],
    smokeParticles: [],
    fireParticles: [],
    smokeParticlePool: createParticlePool(SMOKE_POOL_SIZE),
    fireParticlePool: createParticlePool(FIRE_POOL_SIZE),
    controls: createFlightControls(),
    cameraState: createFlightCameraState(),
    cameraDrag: null,
    keys: createFlightKeys(input),
  };
}
