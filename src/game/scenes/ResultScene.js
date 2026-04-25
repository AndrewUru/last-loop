import Phaser from "phaser";

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: "ResultScene" });
  }

  init(data) {
    this.build = data.build || this.registry.get("rocket-build") || [];
    this.stats = data.stats || {};
    this.result = data.result || "failure";
    this.reason = data.reason || "";
    this.altitude = data.altitude || 0;
    this.horizontalVelocity = data.horizontalVelocity || 0;
    this.flightTime = data.time || 0;
  }

  create() {
    const { width, height } = this.scale;
    const success = this.result === "success";
    const accent = success ? 0x7bc48a : 0xff8d8d;

    this.cameras.main.setBackgroundColor("#0d1217");

    this.add
      .rectangle(width / 2, height / 2, 720, 500, 0x151b22, 0.95)
      .setStrokeStyle(1, accent, 0.46);

    this.add
      .text(width / 2, 152, "MISSION REPORT", {
        fontSize: "16px",
        color: "#9eb4ca",
        fontStyle: "bold",
        letterSpacing: 1.2,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 192, success ? "Orbit Reached" : "Mission Failed", {
        fontSize: "46px",
        color: success ? "#d4f0da" : "#ffbfb6",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 248, this.reason, {
        fontSize: "20px",
        color: "#cad4de",
        align: "center",
        wordWrap: { width: 600 },
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        334,
        [
          `Peak altitude: ${this.altitude.toFixed(1)} km`,
          `Orbital speed: ${this.horizontalVelocity.toFixed(2)} km/s`,
          `Flight time: ${this.flightTime.toFixed(1)} s`,
          `Rocket mass: ${(this.stats.mass || 0).toFixed(0)}`,
          `Fuel capacity: ${(this.stats.fuel || 0).toFixed(0)}`,
          `Launch TWR: ${(this.stats.twr || 0).toFixed(2)}`,
        ].join("\n"),
        {
          fontSize: "22px",
          color: "#f4f7fb",
          align: "center",
          lineSpacing: 12,
        },
      )
      .setOrigin(0.5);

    this.add
      .text(width / 2, 510, "R return to assembly    SPACE relaunch vehicle", {
        fontSize: "18px",
        color: "#9eb4ca",
      })
      .setOrigin(0.5);

    this.createButton(width / 2 - 132, 560, "Assembly", accent, () => {
      this.scene.start("BuildScene", { build: this.build });
    });
    this.createButton(width / 2 + 12, 560, "Relaunch", accent, () => {
      this.scene.start("FlightScene", { build: this.build, stats: this.stats });
    });

    this.input.keyboard.once("keydown-R", () => {
      this.scene.start("BuildScene", { build: this.build });
    });
    this.input.keyboard.once("keydown-SPACE", () => {
      this.scene.start("FlightScene", { build: this.build, stats: this.stats });
    });
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
