const SELECTED_KEY = "last-loop-rocket";

// The rockets the hangar offers, in unlock order. Beating a rocket's
// challenge unlocks the next one.
//
// Art: public/assets/rockets/<id>.png, made from the source illustration in
// art/rockets with tools/prepare_rocket_art.py (it crops and shrinks it).
// `height` is how tall the rocket is drawn, in flight cells; the width follows
// the image. `flames` are where the engine plumes come out, from -0.5 (left
// edge of the image) to 0.5 (right edge).
//
// Stats feed FlightModel directly: twr is the liftoff thrust-to-weight,
// fuel / fuelUse set how long the engines burn, controlAuthority speeds up
// turning and width / dragReduction set the air drag. Challenge limits are
// set a few points short of what a perfect pilot gets (shown in the hangar).
export const ROCKETS = [
  {
    id: "soyuz",
    name: "Soyuz",
    year: 1966,
    country: "URSS",
    realHeight: 50,
    fact: "Desde 1966 ha volado más veces que ningún otro cohete de la historia.",
    height: 7.5,
    flames: [-0.3, 0, 0.3],
    stats: { mass: 50, fuel: 120, fuelUse: 1.65, twr: 1.6, controlAuthority: 0.1, dragReduction: 0, width: 2 },
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
    flames: [0],
    stats: { mass: 100, fuel: 300, fuelUse: 2.2, twr: 1.3, controlAuthority: 0, dragReduction: 0.2, width: 2 },
    challenge: { title: "Rumbo a la Luna", minFuel: 40 },
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
    flames: [-0.29, 0, 0.29],
    stats: { mass: 80, fuel: 170, fuelUse: 2.6, twr: 1.95, controlAuthority: 0.15, dragReduction: 0, width: 3 },
    challenge: { title: "Exprés", maxTime: 76 },
  },
  {
    id: "energia",
    name: "Energía",
    year: 1987,
    country: "URSS",
    realHeight: 59,
    fact: "Lanzó el Buran, el transbordador soviético que voló una sola vez y sin tripulación.",
    height: 8.5,
    flames: [-0.33, 0, 0.33],
    stats: { mass: 110, fuel: 260, fuelUse: 2.4, twr: 1.8, controlAuthority: 0.05, dragReduction: 0.1, width: 2.5 },
    challenge: { title: "Carga pesada", minFuel: 45 },
  },
  {
    id: "ariane-5",
    name: "Ariane 5",
    year: 1996,
    country: "Europa",
    realHeight: 52,
    fact: "Lanzó el telescopio James Webb con tanta precisión que le alargó la vida.",
    height: 8,
    flames: [-0.34, 0, 0.34],
    stats: { mass: 70, fuel: 190, fuelUse: 2, twr: 1.7, controlAuthority: 0.15, dragReduction: 0.2, width: 2 },
    challenge: { title: "Lanzamiento perfecto", maxTime: 80, minFuel: 38 },
  },
  {
    id: "falcon-9",
    name: "Falcon 9",
    year: 2010,
    country: "EE. UU.",
    realHeight: 70,
    fact: "Su primera etapa vuelve a la Tierra y aterriza de pie para volar otra vez.",
    height: 9,
    flames: [0],
    stats: { mass: 55, fuel: 190, fuelUse: 1.7, twr: 2, controlAuthority: 0.3, dragReduction: 0.3, width: 1 },
    challenge: { title: "Reutilizable", minFuel: 52 },
  },
  {
    id: "electron",
    name: "Electron",
    year: 2017,
    country: "Nueva Zelanda",
    realHeight: 18,
    fact: "Sus motores están impresos en 3D y sus bombas funcionan con baterías.",
    height: 5,
    flames: [0],
    stats: { mass: 20, fuel: 70, fuelUse: 1.2, twr: 2.2, controlAuthority: 0.4, dragReduction: 0.3, width: 1 },
    challenge: { title: "Pequeño y veloz", maxTime: 70 },
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
    flames: [-0.32, 0, 0.32],
    stats: { mass: 110, fuel: 330, fuelUse: 2.7, twr: 2.3, controlAuthority: 0.2, dragReduction: 0.2, width: 2.5 },
    challenge: { title: "Rumbo a Marte", maxTime: 71, minFuel: 58 },
  },
  {
    id: "sls",
    name: "SLS",
    year: 2022,
    country: "EE. UU.",
    realHeight: 98,
    fact: "Lanzó la nave Orion de Artemis I, que viajó alrededor de la Luna sin tripulación.",
    height: 10,
    flames: [-0.35, 0, 0.35],
    stats: { mass: 130, fuel: 360, fuelUse: 2.6, twr: 1.6, controlAuthority: 0.1, dragReduction: 0.3, width: 2 },
    challenge: { title: "Artemis", maxTime: 82, minFuel: 50 },
  },
  {
    id: "starship",
    name: "Starship",
    year: 2023,
    country: "EE. UU.",
    realHeight: 121,
    fact: "El cohete más grande y potente jamás construido.",
    height: 11,
    flames: [0],
    stats: { mass: 120, fuel: 330, fuelUse: 2.6, twr: 2.6, controlAuthority: 0.25, dragReduction: 0.3, width: 1.5 },
    challenge: { title: "Leyenda", maxTime: 66, minFuel: 60 },
  },
];

export const ROCKETS_BY_ID = ROCKETS.reduce((rocketsById, rocket) => {
  rocketsById[rocket.id] = rocket;
  return rocketsById;
}, {});

export function getRocket(id) {
  return ROCKETS_BY_ID[id] || ROCKETS[0];
}

export function getRocketTextureKey(rocket) {
  return `rocket-${rocket.id}`;
}

export function getRocketImagePath(rocket) {
  return `assets/rockets/${rocket.id}.png`;
}

// flight: { success, fuelPercent, time }
export function meetsChallenge(challenge, flight) {
  return (
    flight.success &&
    flight.fuelPercent >= (challenge.minFuel ?? 0) &&
    flight.time < (challenge.maxTime ?? Number.POSITIVE_INFINITY)
  );
}

export function describeChallenge(challenge) {
  const conditions = [];
  if (challenge.maxTime) {
    conditions.push(`en menos de ${challenge.maxTime} s`);
  }
  if (challenge.minFuel) {
    conditions.push(`con un ${challenge.minFuel}% de combustible o más`);
  }
  return conditions.length > 0
    ? `Llega a la órbita ${conditions.join(" y ")}.`
    : "Llega a la órbita.";
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
