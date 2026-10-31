import Phaser from "phaser";
import FlightSimulator from "../../systems/FlightSimulator.js";

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

// options go to the flight model (mission wind).
export function createFlightRuntimeState(input, stats, options) {
  return {
    simulator: new FlightSimulator(stats, options),
    finished: false,
    resultOverlayVisible: false,
    lastPhaseId: null,
    maxAltitude: 0,
    flightTrail: [],
    controls: { engineOn: false, throttle: 0, steer: 0 },
    touchControls: { steerLeft: false, steerRight: false, thrust: false },
    cameraState: { initialized: false, x: 0, y: 0, zoom: 1 },
    orbitShot: 0,
    // Five-second cinematic pre-launch. Controls and simulation remain locked
    // until the countdown reaches zero, then the normal flight loop takes over.
    launchSequence: {
      active: true,
      elapsed: 0,
      duration: 5000,
      lastSecond: 5,
      ignitionStarted: false,
    },
    keys: createFlightKeys(input),
    sonicBoomPlayed: false,
    lastWhooshAlt: null,
  };
}
