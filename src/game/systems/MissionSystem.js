import { ROCKETS, ROCKETS_BY_ID, meetsChallenge } from "../data/rockets.js";

const PROGRESS_KEY = "last-loop-progress-v3";

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

// Every rocket has one challenge, and it only counts when flown with that
// rocket. `completed` holds the ids of the rockets whose challenge is done.
export default class MissionSystem {
  static getProgress() {
    return readProgress();
  }

  static isCompleted(rocketId) {
    return readProgress().completed.includes(rocketId);
  }

  // { time, fuelPercent } over every orbit reached with the rocket, or null.
  static getBest(rocketId) {
    return readProgress().best?.[rocketId] || null;
  }

  static isUnlocked(rocketId) {
    const index = ROCKETS.findIndex((rocket) => rocket.id === rocketId);
    return index === 0 || (index > 0 && MissionSystem.isCompleted(ROCKETS[index - 1].id));
  }

  // The first rocket whose challenge is still open: always the newest unlocked one.
  static getCurrentRocket() {
    const { completed } = readProgress();
    return ROCKETS.find((rocket) => !completed.includes(rocket.id)) || null;
  }

  // flight: { rocketId, success, fuelPercent, time }
  // Returns whether this flight beat the rocket's challenge and the rocket it unlocked.
  static recordFlight(flight) {
    const progress = readProgress();
    progress.launches += 1;
    if (flight.success) {
      progress.orbits += 1;
      const best = progress.best?.[flight.rocketId];
      progress.best = {
        ...progress.best,
        [flight.rocketId]: {
          time: Math.min(best?.time ?? Number.POSITIVE_INFINITY, flight.time),
          fuelPercent: Math.max(best?.fuelPercent ?? 0, flight.fuelPercent),
        },
      };
    }

    const rocket = ROCKETS_BY_ID[flight.rocketId];
    const completed =
      Boolean(rocket) && !progress.completed.includes(rocket.id) && meetsChallenge(rocket.challenge, flight);
    if (completed) {
      progress.completed.push(rocket.id);
    }
    writeProgress(progress);

    const unlocked = completed ? ROCKETS[ROCKETS.indexOf(rocket) + 1] || null : null;
    return { completed, unlocked };
  }
}
