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
    engineOn: false,
    throttle: 0,
    steer: 0,
  };
}

function createTouchControls() {
  return {
    steerLeft: false,
    steerRight: false,
    thrust: false,
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
    activeTouchPointers: new Map(),
    pinchZoom: null,
    touchControls: createTouchControls(),
    keys: createFlightKeys(input),
    sonicBoomPlayed: false,
    lastWhooshAlt: null,
  };
}
