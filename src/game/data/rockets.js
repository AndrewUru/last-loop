const SELECTED_KEY = "last-loop-rocket";

// The rockets the hangar offers, in unlock order. Beating a rocket's
// challenge unlocks the next one.
//
// Art: any image in public/assets/rockets works (SVG or PNG), nose up, with a
// transparent background and cropped tight to the rocket. `height` is how tall
// it is drawn in flight cells; the width follows the image. `flames` are where
// the engine plumes come out, from -0.5 (left edge of the image) to 0.5.
//
// Stats feed FlightModel directly: twr is the liftoff thrust-to-weight,
// fuel / fuelUse set how long the engines burn, controlAuthority speeds up
// turning and width / dragReduction set the air drag.
export const ROCKETS = [
  {
    id: "vostok",
    name: "Vostok",
    year: 1961,
    country: "URSS",
    realHeight: 31,
    fact: "Puso en órbita a Yuri Gagarin, el primer ser humano en el espacio.",
    image: "assets/rockets/vostok.svg",
    height: 7,
    flames: [-0.2, 0, 0.2],
    stats: { mass: 50, fuel: 120, fuelUse: 1.65, twr: 1.6, controlAuthority: 0.1, dragReduction: 0, width: 2 },
    challenge: { title: "Primera órbita" },
  },
  {
    id: "saturn-v",
    name: "Saturn V",
    year: 1967,
    country: "EE. UU.",
    realHeight: 111,
    fact: "El cohete del programa Apolo: llevó a 24 astronautas hasta la Luna.",
    image: "assets/rockets/saturn-v.svg",
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
    image: "assets/rockets/shuttle.svg",
    height: 8,
    flames: [-0.29, 0, 0.29],
    stats: { mass: 80, fuel: 170, fuelUse: 2.6, twr: 1.95, controlAuthority: 0.15, dragReduction: 0, width: 3 },
    challenge: { title: "Exprés", maxTime: 76 },
  },
  {
    id: "ariane-5",
    name: "Ariane 5",
    year: 1996,
    country: "Europa",
    realHeight: 52,
    fact: "Lanzó el telescopio James Webb con tanta precisión que le alargó la vida.",
    image: "assets/rockets/ariane-5.svg",
    height: 8,
    flames: [-0.26, 0, 0.26],
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
    image: "assets/rockets/falcon-9.svg",
    height: 9,
    flames: [0],
    stats: { mass: 55, fuel: 190, fuelUse: 1.7, twr: 2, controlAuthority: 0.3, dragReduction: 0.3, width: 1 },
    challenge: { title: "Reutilizable", minFuel: 52 },
  },
  {
    id: "starship",
    name: "Starship",
    year: 2023,
    country: "EE. UU.",
    realHeight: 121,
    fact: "El cohete más grande y potente jamás construido.",
    image: "assets/rockets/starship.svg",
    height: 11,
    flames: [0],
    stats: { mass: 120, fuel: 330, fuelUse: 2.6, twr: 2.6, controlAuthority: 0.25, dragReduction: 0.3, width: 1.5 },
    challenge: { title: "Récord", maxTime: 66 },
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
