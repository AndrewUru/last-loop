import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.load.image("part-capsule", "assets/parts/capsule.png");
    this.load.image("part-fuel-small", "assets/parts/fuel_tank_small.png");
    this.load.image("part-fuel-large", "assets/parts/fuel_tank_large.png");
    this.load.image("part-engine-main", "assets/parts/engine_main.png");
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#040d16");

    const background = this.add.graphics();
    background.fillGradientStyle(0x061726, 0x0c2741, 0x05111c, 0x02060b, 1);
    background.fillRect(0, 0, width, height);
    background.fillStyle(0x1a537a, 0.16);
    background.fillCircle(width * 0.72, height * 0.28, 220);
    background.fillStyle(0xff7d57, 0.1);
    background.fillCircle(width * 0.3, height * 0.74, 260);

    for (let index = 0; index < 85; index += 1) {
      this.add
        .circle(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(0, height),
          Phaser.Math.FloatBetween(1, 2.4),
          Phaser.Math.Between(0xb6dfff, 0xffffff),
          Phaser.Math.FloatBetween(0.16, 0.75),
        )
        .setDepth(1);
    }

    this.add
      .rectangle(width / 2, height / 2, 860, 420, 0x091723, 0.9)
      .setStrokeStyle(2, 0x68d9ff, 0.24);

    this.add
      .text(width / 2, height / 2 - 110, "ORBITAL YARD", {
        fontSize: "68px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height / 2 - 28,
        "Build a rocket from modules, test the balance, and see if it can reach orbit.",
        {
          fontSize: "24px",
          color: "#9adfff",
          align: "center",
          wordWrap: { width: 680 },
        },
      )
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height / 2 + 58,
        "Cockpit + fuel + thrust + symmetry\nThat is the whole fantasy for the MVP.",
        {
          fontSize: "22px",
          color: "#dcefff",
          align: "center",
          lineSpacing: 8,
        },
      )
      .setOrigin(0.5);

    const prompt = this.add
      .text(width / 2, height / 2 + 156, "Click or press SPACE to open the hangar", {
        fontSize: "22px",
        color: "#73f7c0",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    const start = () => this.scene.start("BuildScene");
    this.input.once("pointerdown", start);
    this.input.keyboard.once("keydown-SPACE", start);
  }
}
