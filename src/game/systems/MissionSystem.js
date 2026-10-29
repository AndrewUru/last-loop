const PROGRESS_KEY = "last-loop-progress-v2";

// Missions are tried in order; the first unfinished one is the current goal.
// Completing a mission can unlock new parts in the hangar.
export const MISSIONS = [
  {
    id: "first-orbit",
    title: "Primera órbita",
    description: "Pon el cohete en órbita.",
    unlocks: ["nose_cone", "avionics_ring"],
    check: (flight) => flight.success,
  },
  {
    id: "fuel-saver",
    title: "Ahorrador",
    description: "Llega a la órbita con un 35% de combustible o más.",
    unlocks: ["solid_booster"],
    check: (flight) => flight.success && flight.fuelPercent >= 35,
  },
  {
    id: "quick",
    title: "Exprés",
    description: "Llega a la órbita en menos de 68 segundos.",
    unlocks: [],
    check: (flight) => flight.success && flight.time < 68,
  },
  {
    id: "heavy",
    title: "Carga pesada",
    description: "Llega a la órbita con 7 piezas o más.",
    unlocks: [],
    check: (flight) => flight.success && flight.partCount >= 7,
  },
];

export const STARTING_PARTS = ["capsule", "fuel_tank_small", "fuel_tank_large", "engine_main"];

function readProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (data && Array.isArray(data.completed)) {
      return { launches: 0, orbits: 0, ...data };
    }
  } catch (error) {
    // Private mode or corrupt data: start fresh.
  }
  return { completed: [], launches: 0, orbits: 0 };
}

function writeProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (error) {
    // Progress just won't persist.
  }
}

export default class MissionSystem {
  static getProgress() {
    return readProgress();
  }

  static isCompleted(missionId) {
    return readProgress().completed.includes(missionId);
  }

  static getCurrentMission() {
    const { completed } = readProgress();
    return MISSIONS.find((mission) => !completed.includes(mission.id)) || null;
  }

  static getUnlockedParts() {
    const { completed } = readProgress();
    const unlocked = new Set(STARTING_PARTS);
    MISSIONS.forEach((mission) => {
      if (completed.includes(mission.id)) {
        mission.unlocks.forEach((partId) => unlocked.add(partId));
      }
    });
    return unlocked;
  }

  // flight: { success, fuelPercent, partCount, time }
  static recordFlight(flight) {
    const progress = readProgress();
    progress.launches += 1;
    if (flight.success) {
      progress.orbits += 1;
    }

    const newlyCompleted = MISSIONS.filter(
      (mission) => !progress.completed.includes(mission.id) && mission.check(flight),
    );
    newlyCompleted.forEach((mission) => progress.completed.push(mission.id));
    writeProgress(progress);
    return newlyCompleted;
  }
}
