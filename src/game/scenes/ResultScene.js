import Phaser from "phaser";
import MissionSystem from "../systems/MissionSystem.js";

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: "ResultScene" });
  }

  init(data) {
    this.build = data.build || this.registry.get("rocket-build") || [];
    this.stats = data.stats || {};
    this.result = data.result || "failure";
    this.titleText = data.title || "";
    this.reportKicker = data.reportKicker || "MISSION REPORT";
    this.reason = data.reason || "";
    this.altitude = data.altitude || 0;
    this.horizontalVelocity = data.horizontalVelocity || 0;
    this.flightTime = data.time || 0;
    this.primaryMetricLabel = data.primaryMetricLabel || "Peak altitude";
    this.speedMetricLabel = data.speedMetricLabel || "Orbital speed";
    this.extraLines = Array.isArray(data.extraLines) ? data.extraLines : [];
    this.partCount = this.build.length;
  }

  create() {
    const { width, height } = this.scale;
    const success = this.result === "success";
    const accent = success ? 0x7bc48a : 0xff8d8d;

    this.cameras.main.setBackgroundColor("#0d1217");

    this.missionResults = this.checkMissions();

    this.add
      .rectangle(width / 2, height / 2, 720, 540, 0x151b22, 0.95)
      .setStrokeStyle(1, accent, 0.46);

    this.add
      .text(width / 2, 142, this.reportKicker, {
        fontSize: "16px",
        color: "#9eb4ca",
        fontStyle: "bold",
        letterSpacing: 1.2,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 182, this.titleText || (success ? "Orbit Reached" : "Mission Failed"), {
        fontSize: "42px",
        color: success ? "#d4f0da" : "#ffbfb6",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    if (this.missionResults.length > 0) {
      const missionsText = this.missionResults.map(m => `★ ${m.title} (+${m.reward})`).join("\n");
      this.add
        .text(width / 2, 228, missionsText, {
          fontSize: "16px",
          color: "#ffd700",
          align: "center",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    }

    this.add
      .text(width / 2, success ? (this.missionResults.length > 0 ? 280 : 238) : 238, this.reason, {
        fontSize: "18px",
        color: "#cad4de",
        align: "center",
        wordWrap: { width: 600 },
      })
      .setOrigin(0.5);

    const statsY = success ? (this.missionResults.length > 0 ? 310 : 270) : 270;
    this.add
      .text(
        width / 2,
        statsY,
        [
          `${this.primaryMetricLabel}: ${this.altitude.toFixed(1)} km`,
          `${this.speedMetricLabel}: ${this.horizontalVelocity.toFixed(2)} km/s`,
          `Flight time: ${this.flightTime.toFixed(1)} s`,
          `Rocket mass: ${(this.stats.mass || 0).toFixed(0)}`,
          `Fuel capacity: ${(this.stats.fuel || 0).toFixed(0)}`,
          `Launch TWR: ${(this.stats.twr || 0).toFixed(2)}`,
          `Parts used: ${this.partCount}`,
          ...this.extraLines,
        ].join("\n"),
        {
          fontSize: "20px",
          color: "#f4f7fb",
          align: "center",
          lineSpacing: 10,
        },
      )
      .setOrigin(0.5);

    const funds = MissionSystem.getFunds();
    const progress = MissionSystem.getProgress();
    this.add
      .text(width / 2, 470, `Funds: ${funds} | Launches: ${progress.launches} | Successes: ${progress.successes}`, {
        fontSize: "16px",
        color: "#73f7c0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 500, "R return to assembly    SPACE relaunch vehicle", {
        fontSize: "16px",
        color: "#9eb4ca",
      })
      .setOrigin(0.5);

    this.createButton(width / 2 - 132, 530, "Assembly", accent, () => {
      this.scene.start("BuildScene", { build: this.build });
    });
    this.createButton(width / 2 + 12, 530, "Relaunch", accent, () => {
      this.scene.start("FlightScene", { build: this.build, stats: this.stats });
    });

    this.input.keyboard.once("keydown-R", () => {
      this.scene.start("BuildScene", { build: this.build });
    });
    this.input.keyboard.once("keydown-SPACE", () => {
      this.scene.start("FlightScene", { build: this.build, stats: this.stats });
    });
  }

  checkMissions() {
    const missionStats = {
      result: this.result,
      altitude: this.altitude,
      horizontalVelocity: this.horizontalVelocity,
      fuelRemaining: this.stats.fuelRemaining || 0,
      partCount: this.partCount,
      time: this.flightTime,
    };
    MissionSystem.recordLaunch(this.result === "success");
    return MissionSystem.checkMissions(missionStats);
  }

  createButton(x, y, label, accent, callback) {
    const button = this.add
      .rectangle(x, y, 252, 56, 0x1d252f, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(1, accent, 0.7)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x + 126, y + 28, label, {
        fontSize: "18px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    button.on("pointerdown", callback);
    button.on("pointerover", () => button.setStrokeStyle(2, accent, 1));
    button.on("pointerout", () => button.setStrokeStyle(2, accent, 0.7));
  }
}
