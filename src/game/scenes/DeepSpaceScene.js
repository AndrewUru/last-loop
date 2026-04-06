import Phaser from "phaser";
import ShipPart from "../entities/ShipPart.js";
import { PARTS_BY_ID } from "../data/parts.js";

export default class DeepSpaceScene extends Phaser.Scene {
  constructor() {
    super({ key: "DeepSpaceScene" });
  }

  init(data) {
    this.build = data.build || [];
    this.stats = data.stats || {};
    this.departure = data.departure || {};
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#01040c");
    this.cameras.main.fadeIn(900, 1, 1, 1);

    this.add.rectangle(width / 2, height / 2, width, height, 0x020712, 1);

    this.stars = Array.from({ length: 160 }, () =>
      this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.FloatBetween(1, 2.6),
        Phaser.Math.Between(0xb8daff, 0xffffff),
        Phaser.Math.FloatBetween(0.2, 0.95),
      ),
    );

    this.nebula = this.add.graphics().setDepth(-1);
    this.nebula.fillStyle(0x204d74, 0.08);
    this.nebula.fillCircle(width * 0.18, height * 0.22, 210);
    this.nebula.fillStyle(0xff7b54, 0.05);
    this.nebula.fillCircle(width * 0.82, height * 0.74, 240);

    this.earthGlow = this.add.graphics().setDepth(2);
    this.earthGlow.fillStyle(0x66d5ff, 0.08);
    this.earthGlow.fillCircle(width * 0.18, height * 0.72, 170);

    this.earth = this.add.container(width * 0.18, height * 0.72).setDepth(3);
    const earthBody = this.add.circle(0, 0, 92, 0x153955, 1);
    const earthOcean = this.add.circle(-12, -12, 74, 0x205b83, 1);
    const earthLandA = this.add.ellipse(-18, -10, 56, 28, 0x3b9161, 0.95);
    const earthLandB = this.add.ellipse(24, 20, 68, 34, 0x4ea96f, 0.95);
    const earthAtmosphere = this.add.circle(0, 0, 104, 0x6ad7ff, 0.14).setStrokeStyle(3, 0x8be4ff, 0.35);
    this.earth.add([earthAtmosphere, earthBody, earthOcean, earthLandA, earthLandB]);

    this.rocket = this.createRocketDisplay(width * 0.48, height * 0.46);

    this.title = this.add.text(width / 2, 82, "Earth Left Behind", {
      fontSize: "38px",
      color: "#effcff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.subtitle = this.add.text(
      width / 2,
      128,
      "The ascent scene is complete. The vehicle is now leaving Earth's orbital well.",
      {
        fontSize: "19px",
        color: "#9fdcff",
        align: "center",
        wordWrap: { width: 760 },
      },
    ).setOrigin(0.5);

    this.metrics = this.add.text(
      width / 2,
      height - 118,
      [
        `Departure altitude: ${(this.departure.altitude || 0).toFixed(1)} km`,
        `Tangential speed: ${(this.departure.horizontalVelocity || 0).toFixed(2)} km/s`,
        `Flight time: ${(this.departure.time || 0).toFixed(1)} s`,
        "Press SPACE to continue",
      ].join("    "),
      {
        fontSize: "18px",
        color: "#d9efff",
        align: "center",
      },
    ).setOrigin(0.5);

    this.tweens.add({
      targets: this.earth,
      scaleX: 0.62,
      scaleY: 0.62,
      x: width * 0.11,
      y: height * 0.82,
      duration: 7000,
      ease: "Sine.easeInOut",
    });

    this.tweens.add({
      targets: this.rocket,
      x: width * 0.64,
      y: height * 0.38,
      angle: -10,
      duration: 7000,
      ease: "Sine.easeInOut",
    });

    this.tweens.add({
      targets: this.stars,
      x: "-=140",
      duration: 12000,
      ease: "Linear",
      repeat: -1,
      yoyo: false,
    });

    this.input.keyboard.once("keydown-SPACE", () => {
      this.finishSequence();
    });

    this.time.delayedCall(6200, () => {
      this.finishSequence();
    });
  }

  createRocketDisplay(x, y) {
    const bounds = this.stats.bounds || { minX: 0, maxX: 0, maxY: 0 };
    const cellSize = 42;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = bounds.maxY;
    const container = this.add.container(x, y).setDepth(5);

    this.build.forEach((part) => {
      const definition = PARTS_BY_ID[part.partId];
      if (!definition) {
        return;
      }

      const sprite = new ShipPart(
        this,
        (part.cellX + definition.gridWidth / 2 - centerX) * cellSize,
        (part.cellY + definition.gridHeight / 2 - centerY) * cellSize,
        definition,
        {
          cellSize,
          padding: 6,
          showLabel: false,
          showPlate: false,
        },
      );

      container.add(sprite);
    });

    return container;
  }

  finishSequence() {
    if (this.transitioning) {
      return;
    }

    this.transitioning = true;
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.time.delayedCall(720, () => {
      this.scene.start("ResultScene", {
        build: this.build,
        stats: this.stats,
        result: "success",
        reason: "The ship escaped Earth orbit and entered deep space.",
        altitude: this.departure.altitude || 0,
        horizontalVelocity: this.departure.horizontalVelocity || 0,
        time: this.departure.time || 0,
      });
    });
  }
}
