import Phaser from "phaser";
import ShipPart from "../entities/ShipPart.js";
import { PARTS_BY_ID } from "../data/parts.js";

const MOON_MISSION = Object.freeze({
  distanceKm: 384400,
  targetSpeed: 2.48,
  captureMinSpeed: 2.18,
  captureMaxSpeed: 2.86,
  courseTolerance: 10,
  timeout: 230,
  progressScale: 0.003,
  thrustScale: 0.016,
  burnScale: 0.18,
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatSigned(value, digits = 1) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function getQuadraticPoint(start, control, end, t) {
  const oneMinusT = 1 - t;
  return {
    x:
      oneMinusT * oneMinusT * start.x +
      2 * oneMinusT * t * control.x +
      t * t * end.x,
    y:
      oneMinusT * oneMinusT * start.y +
      2 * oneMinusT * t * control.y +
      t * t * end.y,
  };
}

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
    this.initializeState();
    this.createWorld();
    this.createHud();
    this.registerInput();
    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.handleResize({ width: this.scale.width, height: this.scale.height });
    this.cameras.main.fadeIn(700, 1, 1, 1);
  }

  initializeState() {
    const transferFuel =
      this.departure.fuelRemaining ??
      Math.max(12, (this.stats.fuel || 0) * 0.42);
    const stability = clamp(this.stats.stability || 0.7, 0, 1);

    this.controls = {
      engineOn: false,
      cruiseThrottle: 0.62,
      throttle: 0,
      steer: 0,
    };
    this.state = {
      time: 0,
      progress: 0,
      transferVelocity: clamp(
        this.departure.horizontalVelocity || 1.85,
        1.55,
        2.25,
      ),
      courseError: clamp(9 - stability * 6, 2.2, 9),
      fuelRemaining: Math.max(transferFuel, 8),
      initialFuel: Math.max(transferFuel, 8),
      result: null,
      reason: "",
    };
    this.transitioning = false;
  }

  createWorld() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#01040c");
    this.background = this.add.rectangle(width / 2, height / 2, width, height, 0x020712, 1);
    this.nebula = this.add.graphics().setDepth(0);
    this.stars = Array.from({ length: 190 }, () =>
      this.add
        .circle(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(0, height),
          Phaser.Math.FloatBetween(1, 2.6),
          Phaser.Math.Between(0xb8daff, 0xffffff),
          Phaser.Math.FloatBetween(0.18, 0.9),
        )
        .setDepth(1),
    );

    this.pathGraphics = this.add.graphics().setDepth(2);
    this.bodyGraphics = this.add.graphics().setDepth(3);
    this.enginePlume = this.add.graphics().setDepth(4);
    this.earth = this.add.container(0, 0).setDepth(5);
    this.moon = this.add.container(0, 0).setDepth(5);
    this.rocket = this.createRocketDisplay(0, 0).setDepth(7);

    this.createPlanetBodies();
  }

  createPlanetBodies() {
    this.earth.removeAll(true);
    this.moon.removeAll(true);

    this.earth.add([
      this.add.circle(0, 0, 82, 0x66d5ff, 0.1),
      this.add.circle(0, 0, 58, 0x173b5b, 1),
      this.add.circle(-8, -8, 44, 0x236a9a, 1),
      this.add.ellipse(-12, -6, 38, 18, 0x4ea96f, 0.94),
      this.add.ellipse(16, 16, 46, 22, 0x3b9161, 0.9),
      this.add.circle(0, 0, 66, 0x8be4ff, 0.1).setStrokeStyle(2, 0x8be4ff, 0.32),
    ]);

    this.moon.add([
      this.add.circle(0, 0, 58, 0xe3e6e8, 1),
      this.add.circle(-18, -12, 10, 0xa9b0b7, 0.75),
      this.add.circle(18, 10, 13, 0xb7bdc3, 0.78),
      this.add.circle(0, 24, 7, 0xa2a8ae, 0.7),
      this.add.circle(0, 0, 70, 0xdfefff, 0.08).setStrokeStyle(2, 0xeef7ff, 0.28),
    ]);
  }

  createHud() {
    const panelDepth = 20;
    const textDepth = 21;

    this.title = this.add
      .text(0, 0, "Lunar Transfer", {
        fontSize: "34px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setDepth(textDepth);
    this.subtitle = this.add
      .text(0, 0, "Burn from Earth orbit, trim the course, and enter the lunar capture corridor.", {
        fontSize: "16px",
        color: "#9fdcff",
        align: "center",
        wordWrap: { width: 760 },
      })
      .setOrigin(0.5, 0)
      .setDepth(textDepth);

    this.leftPanel = this.createPanel(panelDepth);
    this.rightPanel = this.createPanel(panelDepth);
    this.leftTitle = this.createHudText("Transfer Data", 18, "#effcff", true);
    this.rightTitle = this.createHudText("Capture", 18, "#effcff", true);
    this.telemetryText = this.createHudText("", 15, "#d9efff");
    this.objectiveText = this.createHudText("", 15, "#d9efff");
    this.hintText = this.createHudText(
      "SPACE/F engine    W/S throttle    A/D trim course    Shift full burn    Esc assembly",
      13,
      "#85a6c2",
    ).setOrigin(0.5);

    this.fuelTrack = this.add.rectangle(0, 0, 220, 10, 0x1a2532, 0.9).setDepth(panelDepth);
    this.fuelFill = this.add.rectangle(0, 0, 220, 10, 0x73f7c0, 0.95).setOrigin(0, 0.5).setDepth(textDepth);
    this.progressTrack = this.add.rectangle(0, 0, 220, 10, 0x1a2532, 0.9).setDepth(panelDepth);
    this.progressFill = this.add.rectangle(0, 0, 220, 10, 0x68d9ff, 0.95).setOrigin(0, 0.5).setDepth(textDepth);

    this.engineButton = this.add
      .rectangle(0, 0, 176, 52, 0x131a22, 0.96)
      .setStrokeStyle(2, 0x7ea3c7, 0.55)
      .setInteractive({ useHandCursor: true })
      .setDepth(panelDepth);
    this.engineButtonStatus = this.createHudText("Engine Idle", 11, "#8fb2d2", true);
    this.engineButtonLabel = this.createHudText("Ignite", 18, "#f4f7fb", true);
    this.engineButton.on("pointerdown", () => this.toggleEngine());
  }

  createPanel(depth) {
    return this.add
      .rectangle(0, 0, 280, 236, 0x111923, 0.78)
      .setOrigin(0)
      .setStrokeStyle(1, 0x9db6d0, 0.2)
      .setDepth(depth);
  }

  createHudText(text, size, color, bold = false) {
    return this.add
      .text(0, 0, text, {
        fontSize: `${size}px`,
        color,
        fontStyle: bold ? "bold" : "",
        lineSpacing: 8,
      })
      .setDepth(21);
  }

  registerInput() {
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      f: Phaser.Input.Keyboard.KeyCodes.F,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
    });
  }

  handleShutdown() {
    this.scale.off("resize", this.handleResize, this);
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;
    const compact = width < 880;
    const panelWidth = compact ? Math.min(300, width - 24) : 280;
    const panelHeight = compact ? 168 : 236;
    const leftX = compact ? 12 : 24;
    const leftY = compact ? height - panelHeight * 2 - 28 : 142;
    const rightX = compact ? 12 : width - panelWidth - 24;
    const rightY = compact ? height - panelHeight - 16 : 142;

    this.layout = {
      compact,
      width,
      height,
      start: { x: width * (compact ? 0.18 : 0.15), y: height * 0.66 },
      control: { x: width * 0.48, y: height * (compact ? 0.2 : 0.16) },
      end: { x: width * (compact ? 0.82 : 0.84), y: height * 0.36 },
    };

    this.background.setPosition(width / 2, height / 2).setSize(width, height);
    this.title.setPosition(width / 2, compact ? 18 : 28);
    this.title.setFontSize(compact ? 26 : 34);
    this.subtitle.setPosition(width / 2, compact ? 52 : 72);
    this.subtitle.setFontSize(compact ? 12 : 16);
    this.subtitle.setWordWrapWidth(Math.min(760, width - 32));

    this.leftPanel.setPosition(leftX, leftY).setSize(panelWidth, panelHeight);
    this.rightPanel.setPosition(rightX, rightY).setSize(panelWidth, panelHeight);
    this.leftTitle.setPosition(leftX + 14, leftY + 12);
    this.rightTitle.setPosition(rightX + 14, rightY + 12);
    this.telemetryText.setPosition(leftX + 14, leftY + 44);
    this.objectiveText.setPosition(rightX + 14, rightY + 44);
    this.telemetryText.setFontSize(compact ? 12 : 15);
    this.objectiveText.setFontSize(compact ? 12 : 15);

    this.fuelTrack.setPosition(leftX + 124, leftY + panelHeight - 34).setSize(panelWidth - 150, 10);
    this.fuelFill.setPosition(leftX + 124 - (panelWidth - 150) / 2, leftY + panelHeight - 34);
    this.progressTrack.setPosition(rightX + 124, rightY + panelHeight - 34).setSize(panelWidth - 150, 10);
    this.progressFill.setPosition(rightX + 124 - (panelWidth - 150) / 2, rightY + panelHeight - 34);

    this.engineButton.setPosition(compact ? width - 100 : 112, height - 48);
    this.engineButtonStatus.setPosition(this.engineButton.x - 76, this.engineButton.y - 17);
    this.engineButtonLabel.setPosition(this.engineButton.x - 76, this.engineButton.y + 2);
    this.hintText.setPosition(width / 2, height - 18);
    this.hintText.setVisible(!compact);

    this.redrawStaticWorld();
  }

  redrawStaticWorld() {
    const { width, height, start, end, control } = this.layout;

    this.nebula.clear();
    this.nebula.fillStyle(0x204d74, 0.08);
    this.nebula.fillCircle(width * 0.18, height * 0.22, 210);
    this.nebula.fillStyle(0xff7b54, 0.05);
    this.nebula.fillCircle(width * 0.82, height * 0.74, 240);

    this.pathGraphics.clear();
    this.pathGraphics.lineStyle(16, 0x73f7c0, 0.04);
    this.pathGraphics.beginPath();
    this.pathGraphics.moveTo(start.x, start.y);
    for (let index = 1; index <= 80; index += 1) {
      const point = getQuadraticPoint(start, control, end, index / 80);
      this.pathGraphics.lineTo(point.x, point.y);
    }
    this.pathGraphics.strokePath();

    this.pathGraphics.lineStyle(2, 0x68d9ff, 0.34);
    this.pathGraphics.beginPath();
    this.pathGraphics.moveTo(start.x, start.y);
    for (let index = 1; index <= 80; index += 1) {
      const point = getQuadraticPoint(start, control, end, index / 80);
      this.pathGraphics.lineTo(point.x, point.y);
    }
    this.pathGraphics.strokePath();

    this.earth.setPosition(start.x, start.y);
    this.moon.setPosition(end.x, end.y);
    this.earth.setScale(this.layout.compact ? 0.68 : 0.92);
    this.moon.setScale(this.layout.compact ? 0.72 : 0.95);

    this.stars.forEach((star) => {
      star.setPosition(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
      );
    });
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.033);

    this.updateControls(delta);
    this.stepMission(dt);
    this.updateVisuals(time);
    this.updateHud();
  }

  updateControls(delta) {
    if (this.state.result) {
      this.controls.throttle = 0;
      this.controls.steer = 0;
      return;
    }

    if (
      Phaser.Input.Keyboard.JustDown(this.keys.space) ||
      Phaser.Input.Keyboard.JustDown(this.keys.f)
    ) {
      this.toggleEngine();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.esc)) {
      this.scene.start("BuildScene", { build: this.build });
      return;
    }

    const upPressed = this.keys.up.isDown || this.keys.w.isDown;
    const downPressed = this.keys.down.isDown || this.keys.s.isDown;
    const leftPressed = this.keys.left.isDown || this.keys.a.isDown;
    const rightPressed = this.keys.right.isDown || this.keys.d.isDown;

    if (upPressed) {
      this.controls.cruiseThrottle = Math.min(
        1,
        this.controls.cruiseThrottle + delta * 0.001,
      );
    }
    if (downPressed) {
      this.controls.cruiseThrottle = Math.max(
        0,
        this.controls.cruiseThrottle - delta * 0.001,
      );
    }

    this.controls.steer = (rightPressed ? 1 : 0) - (leftPressed ? 1 : 0);
    this.controls.throttle =
      this.controls.engineOn && this.state.fuelRemaining > 0
        ? this.keys.shift.isDown
          ? 1
          : this.controls.cruiseThrottle
        : 0;
  }

  toggleEngine() {
    if (this.state.fuelRemaining <= 0 || this.state.result) {
      return;
    }

    this.controls.engineOn = !this.controls.engineOn;
  }

  stepMission(dt) {
    const state = this.state;
    if (state.result) {
      return;
    }

    state.time += dt;

    if (this.controls.throttle > 0 && state.fuelRemaining > 0) {
      const mass = Math.max((this.stats.mass || 40) * 0.7 + state.fuelRemaining * 0.14, 1);
      const acceleration =
        ((this.stats.thrust || 44) / mass) *
        MOON_MISSION.thrustScale *
        this.controls.throttle;
      state.transferVelocity = clamp(
        state.transferVelocity + acceleration * dt,
        1.2,
        3.5,
      );
      state.fuelRemaining = Math.max(
        0,
        state.fuelRemaining -
          Math.max(0.12, (this.stats.fuelUse || 1) * MOON_MISSION.burnScale) *
            this.controls.throttle *
            dt,
      );
    } else {
      state.transferVelocity = Math.max(
        1.05,
        state.transferVelocity - 0.0015 * dt,
      );
    }

    if (state.fuelRemaining <= 0) {
      this.controls.engineOn = false;
    }

    const correctionAuthority = 15 + (this.stats.controlAuthority || 0) * 22;
    const stability = clamp(this.stats.stability || 0.7, 0, 1);
    const drift =
      Math.sin(state.time * 0.42 + 1.4) *
      (0.18 + (1 - stability) * 0.38);
    state.courseError = clamp(
      state.courseError +
        this.controls.steer * correctionAuthority * dt +
        drift * dt +
        Math.sign(state.courseError || 1) *
          Math.max(0, state.transferVelocity - MOON_MISSION.captureMaxSpeed) *
          0.8 *
          dt,
      -32,
      32,
    );

    state.progress = clamp(
      state.progress +
        state.transferVelocity *
          MOON_MISSION.progressScale *
          (1 + state.progress * 0.12) *
          dt,
      0,
      1.08,
    );

    if (
      state.time > 40 &&
      state.fuelRemaining <= 0.01 &&
      state.progress < 0.7 &&
      state.transferVelocity < MOON_MISSION.captureMinSpeed
    ) {
      this.completeMission(
        "failure",
        "Fuel ran out before the ship had enough velocity for lunar transfer.",
      );
      return;
    }

    if (state.time >= MOON_MISSION.timeout) {
      this.completeMission(
        "failure",
        "The transfer window closed before the vehicle reached lunar capture.",
      );
      return;
    }

    if (state.progress >= 1) {
      this.evaluateCapture();
    }
  }

  evaluateCapture() {
    const state = this.state;
    const courseOk = Math.abs(state.courseError) <= MOON_MISSION.courseTolerance;
    const speedOk =
      state.transferVelocity >= MOON_MISSION.captureMinSpeed &&
      state.transferVelocity <= MOON_MISSION.captureMaxSpeed;

    if (courseOk && speedOk) {
      this.completeMission(
        "success",
        "Lunar capture achieved. The vehicle entered a stable orbit around the Moon.",
      );
      return;
    }

    if (!courseOk) {
      this.completeMission(
        "failure",
        "The ship missed the lunar capture corridor. Trim the course closer to zero.",
      );
      return;
    }

    this.completeMission(
      "failure",
      state.transferVelocity > MOON_MISSION.captureMaxSpeed
        ? "The ship arrived too fast and skipped past the Moon."
        : "The ship arrived too slow and fell short of lunar capture.",
    );
  }

  completeMission(result, reason) {
    if (this.state.result) {
      return;
    }

    this.state.result = result;
    this.state.reason = reason;
    this.controls.engineOn = false;
    this.controls.throttle = 0;
    this.cameras.main.shake(result === "success" ? 260 : 420, result === "success" ? 0.002 : 0.004);

    this.time.delayedCall(result === "success" ? 900 : 1200, () => {
      this.finishSequence();
    });
  }

  updateVisuals(time) {
    const { start, control, end } = this.layout;
    const state = this.state;
    const t = clamp(state.progress, 0, 1);
    const position = getQuadraticPoint(start, control, end, t);
    const next = getQuadraticPoint(start, control, end, clamp(t + 0.02, 0, 1));
    const tangent = Math.atan2(next.y - position.y, next.x - position.x);
    const normal = {
      x: Math.cos(tangent + Math.PI / 2),
      y: Math.sin(tangent + Math.PI / 2),
    };
    const courseOffset = state.courseError * (this.layout.compact ? 2.5 : 3.6);

    this.rocket.setPosition(
      position.x + normal.x * courseOffset,
      position.y + normal.y * courseOffset,
    );
    this.rocket.setRotation(tangent + Math.PI / 2);
    this.rocket.setScale(this.layout.compact ? 0.34 : 0.42);

    this.enginePlume.clear();
    if (this.controls.throttle > 0) {
      const plumeLength = 34 + this.controls.throttle * 42 + Math.sin(time / 60) * 5;
      const rearX = this.rocket.x - Math.cos(tangent) * 18;
      const rearY = this.rocket.y - Math.sin(tangent) * 18;
      this.enginePlume.fillStyle(0xfff2bf, 0.9);
      this.enginePlume.fillCircle(rearX, rearY, 6);
      this.enginePlume.fillStyle(0xff8b3d, 0.52);
      this.enginePlume.fillTriangle(
        rearX,
        rearY,
        rearX - Math.cos(tangent - 0.18) * plumeLength,
        rearY - Math.sin(tangent - 0.18) * plumeLength,
        rearX - Math.cos(tangent + 0.18) * plumeLength,
        rearY - Math.sin(tangent + 0.18) * plumeLength,
      );
    }

    this.bodyGraphics.clear();
    this.bodyGraphics.lineStyle(1.5, 0xffd773, 0.55);
    this.bodyGraphics.strokeCircle(this.rocket.x, this.rocket.y, 8);
    if (Math.abs(state.courseError) <= MOON_MISSION.courseTolerance) {
      this.bodyGraphics.lineStyle(2, 0x73f7c0, 0.44);
    } else {
      this.bodyGraphics.lineStyle(2, 0xff8d8d, 0.46);
    }
    this.bodyGraphics.strokeCircle(end.x, end.y, 92);
  }

  updateHud() {
    const state = this.state;
    const distanceRemaining =
      MOON_MISSION.distanceKm * Math.max(0, 1 - state.progress);
    const fuelPct = clamp(state.fuelRemaining / Math.max(state.initialFuel, 1), 0, 1);
    const progressPct = clamp(state.progress, 0, 1);
    const courseOk = Math.abs(state.courseError) <= MOON_MISSION.courseTolerance;
    const speedOk =
      state.transferVelocity >= MOON_MISSION.captureMinSpeed &&
      state.transferVelocity <= MOON_MISSION.captureMaxSpeed;

    this.telemetryText.setText(
      [
        `Distance left   ${distanceRemaining.toFixed(0)} km`,
        `Velocity        ${state.transferVelocity.toFixed(2)} km/s`,
        `Course error    ${formatSigned(state.courseError)} deg`,
        `Throttle        ${Math.round(this.controls.throttle * 100)}%`,
        `Fuel reserve    ${state.fuelRemaining.toFixed(1)}`,
      ].join("\n"),
    );
    this.objectiveText.setText(
      [
        `${state.progress > 0.08 ? "[x]" : "[ ]"} Depart Earth orbit`,
        `${state.transferVelocity >= MOON_MISSION.captureMinSpeed ? "[x]" : "[ ]"} Build transfer speed`,
        `${courseOk ? "[x]" : "[ ]"} Trim capture corridor`,
        `${speedOk ? "[x]" : "[ ]"} Capture velocity`,
        `${state.progress >= 0.92 ? "[x]" : "[ ]"} Enter lunar sphere`,
      ].join("\n"),
    );

    const fuelWidth = this.fuelTrack.width || 0;
    const progressWidth = this.progressTrack.width || 0;
    this.fuelFill.width = fuelWidth * fuelPct;
    this.progressFill.width = progressWidth * progressPct;
    this.fuelFill.setFillStyle(fuelPct < 0.18 ? 0xff8d8d : 0x73f7c0, 0.95);
    this.progressFill.setFillStyle(courseOk ? 0x68d9ff : 0xffd773, 0.95);

    if (this.controls.engineOn) {
      this.engineButton.setFillStyle(0x2a1a12, 0.96).setStrokeStyle(2, 0xff9b5d, 0.82);
      this.engineButtonStatus.setText("Engine Active");
      this.engineButtonStatus.setColor("#ffcfb0");
      this.engineButtonLabel.setText("Cutoff");
    } else {
      this.engineButton.setFillStyle(0x131a22, 0.96).setStrokeStyle(2, 0x7ea3c7, 0.55);
      this.engineButtonStatus.setText("Engine Idle");
      this.engineButtonStatus.setColor("#8fb2d2");
      this.engineButtonLabel.setText("Ignite");
    }
  }

  createRocketDisplay(x, y) {
    const bounds = this.stats.bounds || { minX: 0, maxX: 0, maxY: 0 };
    const cellSize = 30;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = bounds.maxY;
    const container = this.add.container(x, y);

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
          padding: 3,
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
        result: this.state.result || "failure",
        title: this.state.result === "success" ? "Moon Reached" : "Moon Transfer Failed",
        reportKicker: "LUNAR MISSION REPORT",
        reason: this.state.reason,
        altitude: MOON_MISSION.distanceKm * clamp(this.state.progress, 0, 1),
        horizontalVelocity: this.state.transferVelocity,
        time: (this.departure.time || 0) + this.state.time,
        primaryMetricLabel: "Transfer distance",
        speedMetricLabel: "Arrival speed",
        extraLines: [
          `Course error: ${formatSigned(this.state.courseError)} deg`,
          `Fuel remaining: ${this.state.fuelRemaining.toFixed(1)}`,
        ],
      });
    });
  }
}
