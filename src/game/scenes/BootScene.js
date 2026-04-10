import Phaser from "phaser";
import ShipPart from "../entities/ShipPart.js";
import { PARTS_BY_ID } from "../data/parts.js";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.load.image("part-capsule", "assets/parts/capsule.png");
    this.load.image("part-fuel-small", "assets/parts/fuel_tank_small.png");
    this.load.image("part-fuel-large", "assets/parts/fuel_tank_large.png");
    this.load.image("part-engine-main", "assets/parts/engine_main.png");
    this.load.svg("earth-body-sfs", "assets/world/earth_body_sfs.svg");
    this.load.svg("earth-clouds-sfs", "assets/world/earth_clouds_sfs.svg");
    this.load.svg(
      "earth-atmosphere-sfs",
      "assets/world/earth_atmosphere_sfs.svg",
    );
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#040d16");

    this.createBackdrop(width, height);
    this.createHeroPanel(width, height);
    this.createLoopSteps(width, height);
    this.createRocketShowcase(width, height);
    this.createLaunchButton(width, height);
    this.registerStartInput();
  }

  createBackdrop(width, height) {
    const background = this.add.graphics();
    background.fillGradientStyle(0x061726, 0x0c2741, 0x05111c, 0x02060b, 1);
    background.fillRect(0, 0, width, height);
    background.fillStyle(0x1a537a, 0.16);
    background.fillCircle(width * 0.78, height * 0.22, 220);
    background.fillStyle(0xff7d57, 0.1);
    background.fillCircle(width * 0.22, height * 0.76, 260);

    this.add
      .image(width * 0.84, height * 0.9, "earth-atmosphere-sfs")
      .setDisplaySize(560, 560)
      .setAlpha(0.28)
      .setDepth(-2);
    this.add
      .image(width * 0.84, height * 0.9, "earth-body-sfs")
      .setDisplaySize(460, 460)
      .setAlpha(0.42)
      .setDepth(-1);

    for (let index = 0; index < 90; index += 1) {
      this.add
        .circle(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(0, height),
          Phaser.Math.FloatBetween(1, 2.5),
          Phaser.Math.Between(0xb6dfff, 0xffffff),
          Phaser.Math.FloatBetween(0.16, 0.82),
        )
        .setDepth(1);
    }
  }

  createHeroPanel(width, height) {
    const panelX = width * 0.12;
    const panelY = height * 0.12;
    const panelWidth = Math.min(780, width * 0.52);
    const panelHeight = Math.min(540, height * 0.66);

    this.add
      .rectangle(panelX + 6, panelY + 6, panelWidth, panelHeight, 0x000000, 0.18)
      .setOrigin(0)
      .setStrokeStyle(2, 0x68d9ff, 0.06);
    this.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x081624, 0.9)
      .setOrigin(0)
      .setStrokeStyle(2, 0x68d9ff, 0.24);

    this.add.text(panelX + 28, panelY + 28, "GAME JAM MVP", {
      fontSize: "16px",
      color: "#73f7c0",
      fontStyle: "bold",
      letterSpacing: 1.2,
    });

    this.add.text(panelX + 28, panelY + 68, "ORBITAL YARD", {
      fontSize: width < 1100 ? "52px" : "66px",
      color: "#effcff",
      fontStyle: "bold",
    });

    this.add.text(
      panelX + 28,
      panelY + 146,
      "Build a simple ship, survive ascent, nail the turn, and slip into orbit.",
      {
        fontSize: "24px",
        color: "#9adfff",
        wordWrap: { width: panelWidth - 56 },
      },
    );

    this.add.text(
      panelX + 28,
      panelY + 218,
      "No sandbox. No tech demo. Just one clean rocket fantasy for the jam.",
      {
        fontSize: "20px",
        color: "#dcefff",
        wordWrap: { width: panelWidth - 56 },
      },
    );

    this.add.text(panelX + 28, panelY + panelHeight - 58, "SPACE or click to enter the hangar", {
      fontSize: "18px",
      color: "#73f7c0",
      fontStyle: "bold",
    });
  }

  createLoopSteps(width, height) {
    const originX = width * 0.12 + 28;
    const originY = height * 0.12 + 292;
    const stepWidth = Math.min(152, (width * 0.52 - 90) / 4);
    const steps = [
      { label: "Build", body: "Choose capsule, fuel, engine." },
      { label: "Launch", body: "Clear the tower safely." },
      { label: "Turn", body: "Trade climb for lateral speed." },
      { label: "Orbit", body: "Hit the corridor and hold it." },
    ];

    steps.forEach((step, index) => {
      const x = originX + index * (stepWidth + 14);
      this.add
        .rectangle(x, originY, stepWidth, 118, 0x102233, 0.94)
        .setOrigin(0)
        .setStrokeStyle(2, index === steps.length - 1 ? 0x73f7c0 : 0x68d9ff, 0.26);
      this.add.text(x + 16, originY + 16, `0${index + 1}`, {
        fontSize: "14px",
        color: "#73f7c0",
        fontStyle: "bold",
      });
      this.add.text(x + 16, originY + 38, step.label, {
        fontSize: "24px",
        color: "#effcff",
        fontStyle: "bold",
      });
      this.add.text(x + 16, originY + 74, step.body, {
        fontSize: "15px",
        color: "#9adfff",
        wordWrap: { width: stepWidth - 28 },
      });
    });
  }

  createRocketShowcase(width, height) {
    const stageX = width * 0.74;
    const stageY = height * 0.44;

    this.add
      .rectangle(stageX, stageY, 320, 420, 0x091723, 0.82)
      .setStrokeStyle(2, 0x68d9ff, 0.22);
    this.add
      .ellipse(stageX, stageY + 144, 240, 40, 0xffffff, 0.08);
    this.add
      .ellipse(stageX, stageY + 158, 320, 58, 0x8fd7ff, 0.06);

    const showcase = this.add.container(stageX, stageY + 10);
    const parts = [
      { id: "capsule", y: -88 },
      { id: "fuel_tank_large", y: -6 },
      { id: "engine_main", y: 104 },
    ];

    parts.forEach((part) => {
      const definition = PARTS_BY_ID[part.id];
      const view = new ShipPart(this, 0, part.y, definition, {
        cellSize: 62,
        padding: 0,
        showLabel: false,
        showPlate: false,
      });
      showcase.add(view);
    });

    const flame = this.add.graphics();
    showcase.add(flame);

    this.tweens.add({
      targets: showcase,
      y: showcase.y - 8,
      duration: 1500,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    this.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        flame.clear();
        const pulse = 1 + Math.sin(this.time.now / 110) * 0.12;
        flame.fillStyle(0xfff0aa, 0.92);
        flame.fillTriangle(-14, 124, 14, 124, 0, 124 + 54 * pulse);
        flame.fillStyle(0xff8b3d, 0.62);
        flame.fillTriangle(-24, 124, 24, 124, 0, 124 + 82 * pulse);
      },
    });

    this.add.text(stageX, stageY - 182, "One ship. One shot.", {
      fontSize: "24px",
      color: "#effcff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.add.text(stageX, stageY - 148, "Build small, fly clean, reach fake orbit.", {
      fontSize: "18px",
      color: "#8fd7ff",
    }).setOrigin(0.5);
  }

  createLaunchButton(width, height) {
    const x = width * 0.12 + 28;
    const y = height * 0.12 + 476;

    this.startButtonShadow = this.add
      .rectangle(x + 4, y + 4, 230, 58, 0x000000, 0.26)
      .setOrigin(0);
    this.startButton = this.add
      .rectangle(x, y, 230, 58, 0x183c2d, 0.96)
      .setOrigin(0)
      .setStrokeStyle(2, 0x73f7c0, 0.68)
      .setInteractive({ useHandCursor: true });
    this.startButtonLabel = this.add.text(x + 115, y + 29, "Open Hangar", {
      fontSize: "22px",
      color: "#effcff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.startButton.on("pointerover", () => {
      this.startButton.setStrokeStyle(2, 0x73f7c0, 1);
    });
    this.startButton.on("pointerout", () => {
      this.startButton.setStrokeStyle(2, 0x73f7c0, 0.68);
    });
  }

  registerStartInput() {
    let started = false;
    const start = () => {
      if (started) {
        return;
      }
      started = true;
      this.scene.start("BuildScene");
    };
    this.startButton.once("pointerdown", start);
    this.input.once("pointerdown", start);
    this.input.keyboard.once("keydown-SPACE", start);
  }
}
