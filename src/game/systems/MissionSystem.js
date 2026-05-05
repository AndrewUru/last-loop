const MISSIONS_KEY = "last-loop-missions";
const PROGRESS_KEY = "last-loop-progress";

const DEFAULT_MISSIONS = [
  {
    id: "first-orbit",
    title: "First Orbit",
    description: "Achieve a stable orbit around the planet.",
    condition: (stats) => stats.result === "success" && stats.altitude >= 70,
    reward: 100,
    completed: false,
  },
  {
    id: "efficient-launch",
    title: "Efficient Launch",
    description: "Reach orbit with more than 30% fuel remaining.",
    condition: (stats) => stats.result === "success" && stats.fuelRemaining > 30,
    reward: 150,
    completed: false,
  },
  {
    id: "speed-demon",
    title: "Speed Demon",
    description: "Reach orbit with a speed over 2.5 km/s.",
    condition: (stats) => stats.result === "success" && stats.horizontalVelocity > 2.5,
    reward: 200,
    completed: false,
  },
  {
    id: "high-orbit",
    title: "High Orbit",
    description: "Achieve orbit at 120km or higher.",
    condition: (stats) => stats.result === "success" && stats.altitude >= 120,
    reward: 250,
    completed: false,
  },
  {
    id: "minimalist",
    title: "Minimalist Design",
    description: "Reach orbit using 4 or fewer parts.",
    condition: (stats) => stats.result === "success" && stats.partCount <= 4,
    reward: 300,
    completed: false,
  },
];

export default class MissionSystem {
  static getMissions() {
    try {
      const data = localStorage.getItem(MISSIONS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return DEFAULT_MISSIONS.map((m) => ({ ...m }));
  }

  static saveMissions(missions) {
    try {
      localStorage.setItem(MISSIONS_KEY, JSON.stringify(missions));
    } catch (e) {}
  }

  static checkMissions(stats) {
    const missions = this.getMissions();
    const newlyCompleted = [];
    missions.forEach((m) => {
      if (!m.completed && m.condition(stats)) {
        m.completed = true;
        newlyCompleted.push(m);
      }
    });
    if (newlyCompleted.length > 0) {
      this.saveMissions(missions);
      this.addFunds(newlyCompleted.reduce((sum, m) => sum + m.reward, 0));
    }
    return newlyCompleted;
  }

  static getFunds() {
    try {
      const data = localStorage.getItem(PROGRESS_KEY);
      return data ? JSON.parse(data).funds || 0 : 0;
    } catch (e) {
      return 0;
    }
  }

  static addFunds(amount) {
    try {
      const data = localStorage.getItem(PROGRESS_KEY);
      const progress = data ? JSON.parse(data) : {};
      progress.funds = (progress.funds || 0) + amount;
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch (e) {}
  }

  static getProgress() {
    try {
      const data = localStorage.getItem(PROGRESS_KEY);
      return data ? JSON.parse(data) : { funds: 0, launches: 0, successes: 0 };
    } catch (e) {
      return { funds: 0, launches: 0, successes: 0 };
    }
  }

  static recordLaunch(success) {
    try {
      const progress = this.getProgress();
      progress.launches = (progress.launches || 0) + 1;
      if (success) progress.successes = (progress.successes || 0) + 1;
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch (e) {}
  }
}
