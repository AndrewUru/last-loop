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

export const LAUNCH_COUNTDOWN_MS = 5000;
// A retry skips most of the cinematic: the pilot has already seen it.
export const RETRY_COUNTDOWN_MS = 2000;

// options go to the flight model (mission wind).
export function createFlightRuntimeState(input, stats, options, { countdownMs = LAUNCH_COUNTDOWN_MS } = {}) {
  return {
    simulator: new FlightSimulator(stats, options),
    finished: false,
    paused: false,
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
    // Cinematic pre-launch (five seconds, shorter on a retry). Controls and
    // simulation remain locked until the countdown reaches zero, then the
    // normal flight loop takes over.
    launchSequence: {
      active: true,
      elapsed: 0,
      duration: countdownMs,
      remainingMs: countdownMs,
      lastSecond: Math.ceil(countdownMs / 1000),
      ignitionStarted: false,
      cameraRelease: null,
    },
    keys: createFlightKeys(input),
    sonicBoomPlayed: false,
    lastWhooshAlt: null,
  };
}
