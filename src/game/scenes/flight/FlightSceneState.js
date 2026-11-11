import FlightSimulator from "../../systems/FlightSimulator.js";

function createFlightKeys(input) {
  return input.keyboard.addKeys({
    up: "UP",
    left: "LEFT",
    right: "RIGHT",
    w: "W",
    a: "A",
    d: "D",
    space: "SPACE",
    s: "S",
  });
}

// options go to the flight model (mission wind).
export function createFlightRuntimeState(input, stats, options) {
  return {
    simulator: new FlightSimulator(stats, options),
    finished: false,
    resultOverlayVisible: false,
    lastPhaseId: null,
    lastMissionPhase: 0,
    maxAltitude: 0,
    flightTrail: [],
    controls: { engineOn: false, throttle: 0, steer: 0, separate: false },
    touchControls: { steerLeft: false, steerRight: false, thrust: false, separate: false },
    cameraState: { initialized: false, x: 0, y: 0, zoom: 1 },
    cameraRumbleLevel: 0,
    orbitShot: 0,
    phaseShot: 0,
    zoomLabel: null,
    zoomLabelValue: 1,
    // Five-second cinematic pre-launch. Controls and simulation remain locked
    // until the countdown reaches zero, then the normal flight loop takes over.
    launchSequence: {
      active: true,
      elapsed: 0,
      duration: 5000,
      lastSecond: 5,
      ignitionStarted: false,
      cameraRelease: null,
    },
    keys: createFlightKeys(input),
    sonicBoomPlayed: false,
    lastWhooshAlt: null,
  };
}
