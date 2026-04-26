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
    const background = this.add.graphics().setDepth(-30);
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
      .setDepth(-20);
    this.add
      .image(width * 0.84, height * 0.9, "earth-body-sfs")
      .setDisplaySize(460, 460)
      .setAlpha(0.42)
      .setDepth(-19);

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
      .rectangle(
        panelX + 6,
        panelY + 6,
        panelWidth,
        panelHeight,
        0x000000,
        0.18,
      )
      .setOrigin(0)
      .setStrokeStyle(1, 0xffffff, 0.05);
    this.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x12181f, 0.9)
      .setOrigin(0)
      .setStrokeStyle(1, 0xa3b4c7, 0.3);

    this.add.text(panelX + 28, panelY + 28, "SIMULATION", {
      fontSize: "16px",
      color: "#9eb4ca",
      fontStyle: "bold",
      letterSpacing: 1.2,
    });

    this.add.text(panelX + 28, panelY + 68, "SPACE FLIGHT", {
      fontSize: width < 1100 ? "52px" : "66px",
      color: "#f4f7fb",
      fontStyle: "bold",
    });

    this.add.text(
      panelX + 28,
      panelY + 146,
      "Assemble a launch vehicle, survive ascent, and close a stable orbit.",
      {
        fontSize: "24px",
        color: "#d5dee7",
        wordWrap: { width: panelWidth - 56 },
      },
    );

    this.add.text(
      panelX + 28,
      panelY + 218,
      "A compact flight loop focused on staging, ascent control and orbital insertion.",
      {
        fontSize: "20px",
        color: "#aebdcb",
        wordWrap: { width: panelWidth - 56 },
      },
    );

    this.add.text(
      panelX + 28,
      panelY + panelHeight - 58,
      "SPACE or click to enter vehicle assembly",
      {
        fontSize: "18px",
        color: "#9eb4ca",
        fontStyle: "bold",
      },
    );
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
        .setStrokeStyle(
          2,
          index === steps.length - 1 ? 0x73f7c0 : 0x68d9ff,
          0.26,
        );
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
    const showcaseCellSize = 62;
    const stackOverlap = 4;

    this.add
      .rectangle(stageX, stageY, 320, 420, 0x091723, 0.82)
      .setStrokeStyle(2, 0x68d9ff, 0.22);
    this.add.ellipse(stageX, stageY + 144, 240, 40, 0xffffff, 0.08);
    this.add.ellipse(stageX, stageY + 158, 320, 58, 0x8fd7ff, 0.06);

    const showcase = this.add.container(stageX, stageY + 10);
    const parts = ["capsule", "fuel_tank_large", "engine_main"];
    const partViews = [];
    let engineView = null;
    let engineDefinition = null;

    parts.forEach((partId) => {
      const definition = PARTS_BY_ID[partId];
      const view = new ShipPart(this, 0, 0, definition, {
        cellSize: showcaseCellSize,
        padding: 0,
        showLabel: false,
        showPlate: false,
      });

      const visualHeight =
        view.sprite?.displayHeight ?? definition.gridHeight * showcaseCellSize;
      const visualWidth =
        view.sprite?.displayWidth ?? definition.gridWidth * showcaseCellSize;
      partViews.push({ view, definition, visualHeight, visualWidth });
      showcase.add(view);

      if (partId === "engine_main") {
        engineView = view;
        engineDefinition = definition;
      }
    });

    const totalHeight =
      partViews.reduce((sum, part) => sum + part.visualHeight, 0) -
      stackOverlap * Math.max(0, partViews.length - 1);
    let currentTop = -totalHeight / 2;

    partViews.forEach((part) => {
      const centerY = currentTop + part.visualHeight / 2;
      part.view.setPosition(0, centerY);
      currentTop += part.visualHeight - stackOverlap;
    });

    const flame = this.add.graphics();
    showcase.add(flame);

    this.tweens.add({
      targets: showcase,
      y: showcase.y - 3,
      duration: 1800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    this.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        flame.clear();
        if (!engineView) {
          return;
        }

        const engineHeight =
          engineView.sprite?.displayHeight ??
          engineDefinition.gridHeight * showcaseCellSize;
        const engineWidth =
          engineView.sprite?.displayWidth ??
          engineDefinition.gridWidth * showcaseCellSize;
        const exhaustY =
          engineView.y +
          engineHeight * (engineDefinition.exhaustOffsetY ?? 0.42);
        const innerHalfWidth = Math.max(10, engineWidth * 0.18);
        const outerHalfWidth = Math.max(16, engineWidth * 0.3);
        const pulse = 1 + Math.sin(this.time.now / 110) * 0.12;

        flame.fillStyle(0xfff0aa, 0.92);
        flame.fillTriangle(
          -innerHalfWidth,
          exhaustY,
          innerHalfWidth,
          exhaustY,
          0,
          exhaustY + 54 * pulse,
        );
        flame.fillStyle(0xff8b3d, 0.62);
        flame.fillTriangle(
          -outerHalfWidth,
          exhaustY,
          outerHalfWidth,
          exhaustY,
          0,
          exhaustY + 82 * pulse,
        );
      },
    });

    this.add
      .text(stageX, stageY - 182, "One ship. One shot.", {
        fontSize: "24px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(stageX, stageY - 148, "Build small, fly clean, reach fake orbit.", {
        fontSize: "18px",
        color: "#8fd7ff",
      })
      .setOrigin(0.5);
  }

  createLaunchButton(width, height) {
    const x = width * 0.12 + 28;
    const y = height * 0.12 + 476;

    this.startButtonShadow = this.add
      .rectangle(x + 4, y + 4, 230, 58, 0x000000, 0.26)
      .setOrigin(0);
    this.startButton = this.add
      .rectangle(x, y, 230, 58, 0x1b2530, 0.96)
      .setOrigin(0)
      .setStrokeStyle(2, 0x82b6ff, 0.68)
      .setInteractive({ useHandCursor: true });
    this.startButtonLabel = this.add
      .text(x + 115, y + 29, "Enter Assembly", {
        fontSize: "22px",
        color: "#f4f7fb",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.startButton.on("pointerover", () => {
      this.startButton.setStrokeStyle(2, 0x82b6ff, 1);
    });
    this.startButton.on("pointerout", () => {
      this.startButton.setStrokeStyle(2, 0x82b6ff, 0.68);
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
