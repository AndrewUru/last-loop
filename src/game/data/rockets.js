const SELECTED_KEY = "last-loop-rocket";

// The rockets the hangar offers, in unlock order. Beating a rocket's
// challenge unlocks the next one.
//
// Art: public/assets/rockets/<id>.png and the mission patch
// public/assets/patches/<id>.webp, made from the source illustrations in art/
// with tools/prepare_art.py (it crops and shrinks them).
// `height` is how tall the rocket is drawn, in flight cells; the width follows
// the image. `engines` are the plumes: `x` from -0.5 (left edge of the image)
// to 0.5 (right edge) and the propellant they burn, which sets the colour of
// the flame and the smoke (kerosene, hydrogen, solid or methane).
//
// `stages` go from the bottom of the stack to the top (see Staging.js for the
// numbers). `art` are the parts of the image each stage covers, as
// [left, top, right, bottom] shares; `payloadArt` is what is never dropped.
// A stage's `engines` replace the rocket's while it burns; the engines sit at
// the bottom of the stage's art (or of the payload for a stage without art).
//
// Stats feed FlightModel directly: twr is the liftoff thrust-to-weight,
// fuel / fuelUse set how long the engines burn, controlAuthority speeds up
// turning and width / dragReduction set the air drag.
//
// Each rocket has one mission. Every mission ends in orbit; on top of that it
// can ask for any mix of:
//   targets: { kind: "rings" | "parts", count }  fly through rings or pick up
//            parts placed along a good climb
//   hazards: count       debris on the climb path; each hit costs fuel and
//            fails the mission
//   maxQ: { from, to, speed }  top speed (km/s) between two altitudes (km)
//   maxTime (s), minFuel (% left)
//   wind (gust strength), night, singleBurn (each stage lights only once)
//   goal: a phase after reaching orbit, { type: "raise", altitude } (climb to
//         a higher orbit and settle there) or { type: "escape", speed }
//         (speed up out of orbit, bound for the Moon)
// Limits sit a few points short of what a perfect pilot gets (the hangar
// shows that flight).
export const ROCKETS = [
  {
    id: "soyuz",
    name: "Soyuz",
    year: 1966,
    country: "URSS",
    realHeight: 50,
    fact: "Desde 1966 ha volado más veces que ningún otro cohete de la historia.",
    height: 7.5,
    engines: [{ x: -0.3, fuel: "kerosene" }, { x: 0, fuel: "kerosene" }, { x: 0.3, fuel: "kerosene" }],
    stats: { mass: 50, fuel: 120, fuelUse: 1.65, twr: 1.6, controlAuthority: 0.1, dragReduction: 0, width: 2 },
    stages: [
      { name: "Propulsores laterales", kind: "boosters", fuel: 0.38, dry: 0.3, time: 30, art: [[0, 0.53, 0.38, 1], [0.62, 0.53, 1, 1]], engines: [{ x: -0.3, fuel: "kerosene" }, { x: 0, fuel: "kerosene" }, { x: 0.3, fuel: "kerosene" }] },
      { name: "Etapa central", kind: "core", fuel: 0.42, dry: 0.3, time: 30, twr: 1.1, art: [[0.38, 0.45, 0.62, 1], [0, 0.45, 0.38, 0.53], [0.62, 0.45, 1, 0.53]], engines: [{ x: 0, fuel: "kerosene" }] },
      { name: "Etapa superior", kind: "upper", fuel: 0.2, dry: 0.15, time: 35, twr: 0.9, art: [[0, 0.3, 1, 0.45]], engines: [{ x: 0, fuel: "kerosene" }] },
    ],
    payloadArt: [[0, 0, 1, 0.3]],
    challenge: { title: "Primera órbita" },
  },
  {
    id: "saturn-v",
    name: "Saturno V",
    year: 1967,
    country: "EE. UU.",
    realHeight: 111,
    fact: "El cohete del programa Apolo: llevó a 24 astronautas hasta la Luna.",
    height: 10.5,
    engines: [{ x: 0, fuel: "kerosene" }],
    stats: { mass: 100, fuel: 300, fuelUse: 2.2, twr: 1.3, controlAuthority: 0, dragReduction: 0.2, width: 2 },
    stages: [
      { name: "S-IC", kind: "core", fuel: 0.5, dry: 0.3, time: 30, art: [[0, 0.62, 1, 1]], engines: [{ x: 0, fuel: "kerosene" }] },
      { name: "S-II", kind: "core", fuel: 0.32, dry: 0.15, time: 35, twr: 1.0, art: [[0, 0.4, 1, 0.62]], engines: [{ x: 0, fuel: "hydrogen" }] },
      { name: "S-IVB", kind: "upper", fuel: 0.18, dry: 0.1, time: 50, twr: 0.8, art: [[0, 0.27, 1, 0.4]], engines: [{ x: 0, fuel: "hydrogen" }] },
    ],
    payloadArt: [[0, 0, 1, 0.27]],
    challenge: { title: "Rumbo a la Luna", goal: { type: "escape", speed: 10 } },
  },
  {
    id: "shuttle",
    name: "Transbordador espacial",
    shortName: "Shuttle",
    year: 1981,
    country: "EE. UU.",
    realHeight: 56,
    fact: "Despegaba como un cohete y aterrizaba como un avión.",
    height: 8,
    engines: [{ x: -0.29, fuel: "solid" }, { x: 0, fuel: "hydrogen" }, { x: 0.29, fuel: "solid" }],
    stats: { mass: 80, fuel: 170, fuelUse: 2.6, twr: 1.95, controlAuthority: 0.15, dragReduction: 0, width: 3 },
    stages: [
      { name: "Propulsores sólidos", kind: "boosters", fuel: 0.45, dry: 0.35, time: 30, art: [[0, 0.18, 0.23, 1], [0.77, 0.18, 1, 1]], engines: [{ x: -0.29, fuel: "solid" }, { x: 0, fuel: "hydrogen" }, { x: 0.29, fuel: "solid" }] },
      { name: "Orbitador y tanque", kind: "core", fuel: 0.55, dry: 0.2, time: 75, twr: 1.0, art: [], engines: [{ x: 0, fuel: "hydrogen" }] },
    ],
    payloadArt: [[0.23, 0, 0.77, 1], [0, 0, 0.23, 0.18], [0.77, 0, 1, 0.18]],
    challenge: { title: "Misión Hubble", targets: { kind: "parts", count: 4 }, goal: { type: "raise", altitude: 300 } },
  },
  {
    id: "energia",
    name: "Energía",
    year: 1987,
    country: "URSS",
    realHeight: 59,
    fact: "Lanzó el Buran, el transbordador soviético que voló una sola vez y sin tripulación.",
    height: 8.5,
    engines: [{ x: -0.33, fuel: "kerosene" }, { x: 0, fuel: "hydrogen" }, { x: 0.33, fuel: "kerosene" }],
    stats: { mass: 110, fuel: 260, fuelUse: 2.4, twr: 1.8, controlAuthority: 0.05, dragReduction: 0.1, width: 2.5 },
    stages: [
      { name: "Propulsores laterales", kind: "boosters", fuel: 0.45, dry: 0.35, time: 32, art: [[0, 0.33, 0.3, 1], [0.7, 0.33, 1, 1]], engines: [{ x: -0.33, fuel: "kerosene" }, { x: 0, fuel: "hydrogen" }, { x: 0.33, fuel: "kerosene" }] },
      { name: "Etapa central", kind: "core", fuel: 0.55, dry: 0.25, time: 70, twr: 1.0, art: [], engines: [{ x: 0, fuel: "hydrogen" }] },
    ],
    payloadArt: [[0.3, 0, 0.7, 1], [0, 0, 0.3, 0.33], [0.7, 0, 1, 0.33]],
    challenge: { title: "Tormenta en Baikonur", wind: 0.6, goal: { type: "raise", altitude: 280 } },
  },
  {
    id: "ariane-5",
    name: "Ariane 5",
    year: 1996,
    country: "Europa",
    realHeight: 52,
    fact: "Lanzó el telescopio James Webb con tanta precisión que le alargó la vida.",
    height: 8,
    engines: [{ x: -0.34, fuel: "solid" }, { x: 0, fuel: "hydrogen" }, { x: 0.34, fuel: "solid" }],
    stats: { mass: 70, fuel: 190, fuelUse: 2, twr: 1.7, controlAuthority: 0.15, dragReduction: 0.2, width: 2 },
    stages: [
      { name: "Propulsores sólidos", kind: "boosters", fuel: 0.45, dry: 0.35, time: 30, art: [[0, 0.4, 0.3, 1], [0.7, 0.4, 1, 1]], engines: [{ x: -0.34, fuel: "solid" }, { x: 0, fuel: "hydrogen" }, { x: 0.34, fuel: "solid" }] },
      { name: "Etapa principal", kind: "core", fuel: 0.4, dry: 0.25, time: 35, twr: 1.0, art: [[0.3, 0.32, 0.7, 1], [0, 0.32, 0.3, 0.4], [0.7, 0.32, 1, 0.4]], engines: [{ x: 0, fuel: "hydrogen" }] },
      { name: "Etapa superior", kind: "upper", fuel: 0.15, dry: 0.1, time: 45, twr: 0.8, art: [[0, 0.27, 1, 0.32]], engines: [{ x: 0, fuel: "hydrogen" }] },
    ],
    payloadArt: [[0, 0, 1, 0.27]],
    challenge: { title: "Carga delicada", maxQ: { from: 10, to: 35, speed: 2 }, goal: { type: "raise", altitude: 340 } },
  },
  {
    id: "falcon-9",
    name: "Falcon 9",
    year: 2010,
    country: "EE. UU.",
    realHeight: 70,
    fact: "Su primera etapa vuelve a la Tierra y aterriza de pie para volar otra vez.",
    height: 9,
    engines: [{ x: 0, fuel: "kerosene" }],
    stats: { mass: 55, fuel: 190, fuelUse: 1.7, twr: 2, controlAuthority: 0.3, dragReduction: 0.3, width: 1 },
    stages: [
      { name: "Primera etapa", kind: "core", fuel: 0.72, dry: 0.5, time: 35, art: [[0, 0.31, 1, 1]], engines: [{ x: 0, fuel: "kerosene" }] },
      { name: "Segunda etapa", kind: "upper", fuel: 0.28, dry: 0.15, time: 50, twr: 0.9, art: [[0, 0.24, 1, 0.31]], engines: [{ x: 0, fuel: "kerosene" }] },
    ],
    payloadArt: [[0, 0, 1, 0.24]],
    challenge: { title: "Noche en Cabo Cañaveral", night: true, minFuel: 12, goal: { type: "raise", altitude: 260 } },
  },
  {
    id: "electron",
    name: "Electron",
    year: 2017,
    country: "Nueva Zelanda",
    realHeight: 18,
    fact: "Sus motores están impresos en 3D y sus bombas funcionan con baterías.",
    height: 5,
    engines: [{ x: 0, fuel: "kerosene" }],
    stats: { mass: 20, fuel: 70, fuelUse: 1.2, twr: 2.2, controlAuthority: 0.4, dragReduction: 0.3, width: 1 },
    stages: [
      { name: "Primera etapa", kind: "core", fuel: 0.72, dry: 0.5, time: 30, art: [[0, 0.33, 1, 1]], engines: [{ x: 0, fuel: "kerosene" }] },
      { name: "Segunda etapa", kind: "upper", fuel: 0.28, dry: 0.15, time: 35, twr: 0.9, art: [[0, 0.21, 1, 0.33]], engines: [{ x: 0, fuel: "kerosene" }] },
    ],
    payloadArt: [[0, 0, 1, 0.21]],
    challenge: { title: "Slalom", targets: { kind: "rings", count: 5 } },
  },
  {
    id: "falcon-heavy",
    name: "Falcon Heavy",
    shortName: "F. Heavy",
    year: 2018,
    country: "EE. UU.",
    realHeight: 70,
    fact: "En su primer vuelo envió un coche descapotable rojo rumbo a Marte.",
    height: 9,
    engines: [{ x: -0.32, fuel: "kerosene" }, { x: 0, fuel: "kerosene" }, { x: 0.32, fuel: "kerosene" }],
    stats: { mass: 110, fuel: 330, fuelUse: 2.7, twr: 2.3, controlAuthority: 0.2, dragReduction: 0.2, width: 2.5 },
    stages: [
      { name: "Propulsores laterales", kind: "boosters", fuel: 0.45, dry: 0.4, time: 28, art: [[0, 0.36, 0.33, 1], [0.67, 0.36, 1, 1]], engines: [{ x: -0.32, fuel: "kerosene" }, { x: 0, fuel: "kerosene" }, { x: 0.32, fuel: "kerosene" }] },
      { name: "Núcleo central", kind: "core", fuel: 0.35, dry: 0.2, time: 28, twr: 1.1, art: [[0.33, 0.36, 0.67, 1]], engines: [{ x: 0, fuel: "kerosene" }] },
      { name: "Segunda etapa", kind: "upper", fuel: 0.2, dry: 0.1, time: 50, twr: 0.9, art: [[0, 0.27, 1, 0.36]], engines: [{ x: 0, fuel: "kerosene" }] },
    ],
    payloadArt: [[0, 0, 1, 0.27]],
    challenge: { title: "Encendido único", singleBurn: true, goal: { type: "raise", altitude: 360 } },
  },
  {
    id: "sls",
    name: "SLS",
    year: 2022,
    country: "EE. UU.",
    realHeight: 98,
    fact: "Lanzó la nave Orion de Artemis I, que viajó alrededor de la Luna sin tripulación.",
    height: 10,
    engines: [{ x: -0.35, fuel: "solid" }, { x: 0, fuel: "hydrogen" }, { x: 0.35, fuel: "solid" }],
    stats: { mass: 130, fuel: 360, fuelUse: 2.6, twr: 1.6, controlAuthority: 0.1, dragReduction: 0.3, width: 2 },
    stages: [
      { name: "Propulsores sólidos", kind: "boosters", fuel: 0.4, dry: 0.35, time: 28, art: [[0, 0.47, 0.3, 1], [0.7, 0.47, 1, 1]], engines: [{ x: -0.35, fuel: "solid" }, { x: 0, fuel: "hydrogen" }, { x: 0.35, fuel: "solid" }] },
      { name: "Etapa central", kind: "core", fuel: 0.45, dry: 0.3, time: 35, twr: 1.0, art: [[0.3, 0.25, 0.7, 1], [0, 0.25, 0.3, 0.47], [0.7, 0.25, 1, 0.47]], engines: [{ x: 0, fuel: "hydrogen" }] },
      { name: "Etapa superior", kind: "upper", fuel: 0.15, dry: 0.1, time: 45, twr: 0.7, art: [[0, 0.17, 1, 0.25]], engines: [{ x: 0, fuel: "hydrogen" }] },
    ],
    payloadArt: [[0, 0, 1, 0.17]],
    challenge: { title: "Campo de escombros", hazards: 7, goal: { type: "escape", speed: 10.5 } },
  },
  {
    id: "starship",
    name: "Starship",
    year: 2023,
    country: "EE. UU.",
    realHeight: 121,
    fact: "El cohete más grande y potente jamás construido.",
    height: 11,
    engines: [{ x: 0, fuel: "methane" }],
    stats: { mass: 120, fuel: 330, fuelUse: 2.6, twr: 2.6, controlAuthority: 0.25, dragReduction: 0.3, width: 1.5 },
    stages: [
      { name: "Super Heavy", kind: "core", fuel: 0.7, dry: 0.55, time: 35, art: [[0, 0.42, 1, 1]], engines: [{ x: 0, fuel: "methane" }] },
      { name: "Nave Starship", kind: "upper", fuel: 0.3, dry: 0.3, time: 60, twr: 1.0, art: [], engines: [{ x: 0, fuel: "methane" }] },
    ],
    payloadArt: [[0, 0, 1, 0.42]],
    challenge: { title: "Leyenda", targets: { kind: "rings", count: 6 }, maxTime: 170, goal: { type: "raise", altitude: 300 } },
  },
];

export const ROCKETS_BY_ID = ROCKETS.reduce((rocketsById, rocket) => {
  rocketsById[rocket.id] = rocket;
  return rocketsById;
}, {});

export function getRocket(id) {
  return ROCKETS_BY_ID[id] || ROCKETS[0];
}

// The mission as phases: reaching orbit, then the rocket's goal if it has one.
export function getMissionPhases(rocket) {
  return [{ type: "orbit" }, ...(rocket.challenge.goal ? [rocket.challenge.goal] : [])];
}

// What the flight model needs from a rocket besides its stats.
export function getFlightOptions(rocket) {
  return { stages: rocket.stages, phases: getMissionPhases(rocket) };
}

export function getRocketTextureKey(rocket) {
  return `rocket-${rocket.id}`;
}

export function getRocketImagePath(rocket) {
  return `assets/rockets/${rocket.id}.png`;
}

export function getPatchTextureKey(rocket) {
  return `patch-${rocket.id}`;
}

export function getPatchImagePath(rocket) {
  return `assets/patches/${rocket.id}.webp`;
}

const TARGET_NAMES = { rings: ["anillo", "anillos"], parts: ["pieza", "piezas"] };

export function getTargetName(kind, count) {
  const [one, many] = TARGET_NAMES[kind];
  return count === 1 ? one : many;
}

export function formatSpeed(speed) {
  return `${speed.toFixed(1).replace(".", ",")} km/s`;
}

function joinClauses(clauses) {
  return clauses.length > 1 ? `${clauses.slice(0, -1).join(", ")} y ${clauses[clauses.length - 1]}` : clauses[0];
}

export function describeChallenge(challenge) {
  const clauses = [];
  if (challenge.targets) {
    const { kind, count } = challenge.targets;
    clauses.push(`${kind === "rings" ? "pasando por los" : "recogiendo las"} ${count} ${getTargetName(kind, count)}`);
  }
  if (challenge.hazards) {
    clauses.push("sin chocar con los escombros");
  }
  if (challenge.maxQ) {
    const { from, to, speed } = challenge.maxQ;
    clauses.push(`sin pasar de ${formatSpeed(speed)} entre ${from} y ${to} km`);
  }
  if (challenge.wind) {
    clauses.push("contra ráfagas de viento");
  }
  if (challenge.night) {
    clauses.push("de noche");
  }
  if (challenge.singleBurn) {
    clauses.push("encendiendo el motor una sola vez");
  }
  if (challenge.maxTime) {
    clauses.push(`en menos de ${challenge.maxTime} s`);
  }
  if (challenge.minFuel) {
    clauses.push(`con un ${challenge.minFuel}% de combustible o más`);
  }
  const base = clauses.length > 0 ? `Llega a la órbita ${joinClauses(clauses)}.` : "Llega a la órbita.";
  return challenge.goal ? `${base} ${describeGoal(challenge.goal)}` : base;
}

// The phase after orbit, as one sentence.
export function describeGoal(goal) {
  if (goal.type === "raise") {
    return `Después, sube a una órbita alta de ${goal.altitude} km.`;
  }
  if (goal.type === "escape") {
    return `Después, acelera hasta ${formatSpeed(goal.speed)} rumbo a la Luna.`;
  }
  return "";
}

// Max-Q is forgiven by half a decimal, so it never fails on a speed that the
// tracker shows as equal to the limit.
export const MAX_Q_TOLERANCE = 0.05;

// flight: { success, fuelPercent, time, targetsHit, hazardsHit, maxQSpeed }
// Returns whether the mission is done and, if the orbit was reached but the
// mission was not, why.
export function evaluateChallenge(challenge, flight) {
  if (!flight.success) {
    return { completed: false, missed: null };
  }
  const missed = [];
  if (challenge.targets && flight.targetsHit < challenge.targets.count) {
    const left = challenge.targets.count - flight.targetsHit;
    missed.push(`Te ${left === 1 ? "faltó" : "faltaron"} ${left} ${getTargetName(challenge.targets.kind, left)}.`);
  }
  if (challenge.hazards && flight.hazardsHit > 0) {
    missed.push(`Chocaste con ${flight.hazardsHit === 1 ? "un escombro" : `${flight.hazardsHit} escombros`}.`);
  }
  if (challenge.maxQ && flight.maxQSpeed > challenge.maxQ.speed + MAX_Q_TOLERANCE) {
    missed.push(`Pasaste de ${formatSpeed(challenge.maxQ.speed)} en la zona de Max-Q.`);
  }
  if (challenge.maxTime && flight.time >= challenge.maxTime) {
    missed.push(`Tardaste más de ${challenge.maxTime} s.`);
  }
  if (challenge.minFuel && flight.fuelPercent < challenge.minFuel) {
    missed.push(`Te quedó un ${flight.fuelPercent}% de combustible (mínimo ${challenge.minFuel}%).`);
  }
  return { completed: missed.length === 0, missed: missed[0] || null };
}

export function loadSelectedRocketId() {
  try {
    return localStorage.getItem(SELECTED_KEY) || ROCKETS[0].id;
  } catch (error) {
    return ROCKETS[0].id;
  }
}

export function saveSelectedRocketId(id) {
  try {
    localStorage.setItem(SELECTED_KEY, id);
  } catch (error) {
    // The choice just won't persist between visits.
  }
}
