import Phaser from "phaser";
import ShipPart from "../entities/ShipPart.js";
import { PARTS_BY_ID } from "../data/parts.js";
import ShipStatsCalculator from "../systems/ShipStatsCalculator.js";
import FlightSimulator, { FLIGHT_WORLD } from "../systems/FlightSimulator.js";
import FlightHud from "../ui/FlightHud.js";

const ROCKET_CELL_SIZE = 54;
const TRAIL_LIMIT = 180;
const STAR_COUNT = 130;
const LAUNCH_PRESENTATION_ALTITUDE = 72;
const ORBIT_CAMERA_START_ALTITUDE = 128;
const ORBIT_CAMERA_END_ALTITUDE = 220;
const PLANET_REVEAL_ALTITUDE = 132;
const GUIDANCE_REVEAL_ALTITUDE = 118;
const PAD_FADE_ALTITUDE = 108;
const INITIAL_CAMERA_ZOOM = 1.36;
const MIN_ORBIT_CAMERA_ZOOM = 0.42;
const DAY_SKY_FADE_START_ALTITUDE = 72;
const DAY_SKY_FADE_END_ALTITUDE = 220;
const LAUNCH_BURST_ALTITUDE = 24;
const LAUNCH_SPEED_LINE_COUNT = 8;

function angleDifference(target, current) {
  let delta = target - current;

  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }

  return delta;
}

function getBuildCenter(bounds) {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: bounds.maxY,
  };
}

export default class FlightScene extends Phaser.Scene {
  constructor() {
    super({ key: "FlightScene" });
  }

  init(data) {
    this.build = data.build || this.registry.get("rocket-build") || [];
    this.stats = data.stats || ShipStatsCalculator.calculate(this.build);
  }

  create() {
    this.initializeState();
    this.createBackdrop();
    this.createWorld();
    this.createRocket();
    this.createHud();
    this.createMissionOverlay();
    this.registerInput();
    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.handleResize({ width: this.scale.width, height: this.scale.height });
  }

  initializeState() {
    this.simulator = new FlightSimulator(this.stats);
    this.finished = false;
    this.resultOverlayVisible = false;
    this.launchBurstPlayed = false;
    this.flightTrail = [];
    this.smokeTrail = [];
    this.controls = {
      throttle: 0,
      cruiseThrottle: 0.85,
      steer: 0,
      engineOn: false,
      source: "Pilot",
    };
    this.cameraState = {
      centerX: 0,
      centerY: -FLIGHT_WORLD.planetRadius + 10,
      zoom: INITIAL_CAMERA_ZOOM,
      panX: 0,
      panY: 0,
      zoomFactor: 1,
    };
    this.cameraDrag = null;
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
      h: Phaser.Input.Keyboard.KeyCodes.H,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    });
    this.onToggleHelp = () => this.hud.toggleHelp();
    this.onResultRebuild = () => {
      if (this.finished) {
        this.returnToBuild();
      }
    };
    this.onResultRelaunch = () => {
      if (this.finished) {
        this.restartFlight();
      }
    };
    this.onEscapeToBuild = () => {
      this.scene.start("BuildScene", { build: this.build });
    };
  }

  createBackdrop() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#79c4ff");

    this.daySky = this.add.graphics().setScrollFactor(0).setDepth(-40);
    this.daySky.fillGradientStyle(0x79bfff, 0x63b1f2, 0xdfefff, 0x9ccaf4, 1);
    this.daySky.fillRect(0, 0, width, height);

    this.sunGlow = this.add
      .circle(width * 0.78, height * 0.2, 118, 0xffefbc, 0.22)
      .setScrollFactor(0)
      .setDepth(-39);
    this.sunCore = this.add
      .circle(width * 0.78, height * 0.2, 40, 0xfff7dc, 0.74)
      .setScrollFactor(0)
      .setDepth(-38);
    this.skyHaze = this.add.graphics().setScrollFactor(0).setDepth(-37);
    this.skyHaze.fillStyle(0xf8fcff, 0.08);
    this.skyHaze.fillEllipse(
      width * 0.5,
      height * 0.82,
      width * 1.5,
      height * 0.34,
    );

    this.spaceShade = this.add.graphics().setScrollFactor(0).setDepth(-36);
    this.spaceShade.fillStyle(0x04111d, 1);
    this.spaceShade.fillRect(0, 0, width, height);
    this.spaceShade.setAlpha(0);

    this.stars = Array.from({ length: STAR_COUNT }, () =>
      this.add
        .circle(
          Phaser.Math.Between(-width, width * 2),
          Phaser.Math.Between(-height, height * 2),
          Phaser.Math.FloatBetween(1, 2.6),
          Phaser.Math.Between(0xb8daff, 0xffffff),
          Phaser.Math.FloatBetween(0.08, 0.35),
        )
        .setScrollFactor(0.04)
        .setAlpha(0),
    );
  }

  createWorld() {
    this.orbitBand = this.add.graphics().setDepth(-15);
    this.orbitGuides = this.add.graphics().setDepth(-14);
    this.horizonGlow = this.add.graphics().setDepth(-13);
    this.highAltitudeHorizon = this.add.graphics().setDepth(-12);
    this.launchBackdrop = this.add.graphics().setDepth(-10);
    this.launchGround = this.add.graphics().setDepth(-9);
    this.trailGraphics = this.add.graphics().setDepth(8);
    this.trajectoryGraphics = this.add.graphics().setDepth(9);
    this.markerGraphics = this.add.graphics().setDepth(10);
    this.padGlow = this.add.graphics().setDepth(10);
    this.pad = this.add.container(0, 0).setDepth(11);
    this.launchSpeedLines = this.add.graphics().setDepth(17);

    this.drawOrbitGuides();
    this.drawLaunchBackdrop();
    this.drawLaunchGround();
    this.buildLaunchPad();
  }

  drawOrbitGuides() {
    const radius = FLIGHT_WORLD.planetRadius;
    const atmosphereRadius = radius + FLIGHT_WORLD.atmosphereHeight;
    const targetRadius = radius + FLIGHT_WORLD.targetOrbitAltitude;

    this.horizonGlow.clear();
    this.horizonGlow.fillStyle(0x8edbff, 0.1);
    this.horizonGlow.fillEllipse(0, 74, 980, 120);

    this.highAltitudeHorizon.clear();
    this.highAltitudeHorizon.fillStyle(0x4c8fd0, 0.32);
    this.highAltitudeHorizon.fillEllipse(0, 116, 760, 68);
    this.highAltitudeHorizon.fillStyle(0xdff4ff, 0.08);
    this.highAltitudeHorizon.fillEllipse(0, 90, 840, 24);

    this.orbitBand.clear();
    this.orbitBand.lineStyle(24, 0x73f7c0, 0.06);
    this.orbitBand.strokeCircle(0, 0, targetRadius);

    this.orbitGuides.clear();
    this.orbitGuides.lineStyle(1, 0x68d9ff, 0.16);
    this.orbitGuides.strokeCircle(0, 0, atmosphereRadius);
    this.orbitGuides.lineStyle(2, 0x73f7c0, 0.22);
    this.orbitGuides.strokeCircle(0, 0, targetRadius);
  }

  buildLaunchPad() {
    const padY = -FLIGHT_WORLD.planetRadius;

    this.pad.add([
      this.add.rectangle(0, padY + 42, 188, 16, 0x5f7386, 0.94),
      this.add.rectangle(0, padY + 31, 240, 6, 0x8fa5b8, 0.74),
      this.add.rectangle(0, padY + 52, 118, 10, 0x324454, 0.88),
      this.add.rectangle(0, padY + 22, 28, 14, 0xb7c8d6, 0.42),
    ]);
  }

  drawLaunchBackdrop() {
    const padY = -FLIGHT_WORLD.planetRadius;

    this.launchBackdrop.clear();
    this.launchBackdrop.fillStyle(0x122231, 0.18);
    this.launchBackdrop.fillEllipse(0, padY + 102, 320, 38);
    this.launchBackdrop.fillStyle(0xff8a55, 0.08);
    this.launchBackdrop.fillEllipse(0, padY + 58, 156, 28);
  }

  drawLaunchGround() {
    const padY = -FLIGHT_WORLD.planetRadius;
    const groundY = padY + 62;

    this.launchGround.clear();
    this.launchGround.fillStyle(0x5f7890, 0.94);
    this.launchGround.fillRect(-920, groundY, 1840, 560);

    this.launchGround.fillStyle(0x52687c, 0.92);
    this.launchGround.beginPath();
    this.launchGround.moveTo(-920, groundY + 26);
    this.launchGround.lineTo(-620, groundY + 10);
    this.launchGround.lineTo(-320, groundY + 14);
    this.launchGround.lineTo(0, groundY + 2);
    this.launchGround.lineTo(320, groundY + 14);
    this.launchGround.lineTo(620, groundY + 10);
    this.launchGround.lineTo(920, groundY + 26);
    this.launchGround.lineTo(920, groundY + 560);
    this.launchGround.lineTo(-920, groundY + 560);
    this.launchGround.closePath();
    this.launchGround.fillPath();

    this.launchGround.fillStyle(0x8da4b7, 0.22);
    this.launchGround.fillRect(-920, groundY + 4, 1840, 4);
    this.launchGround.fillStyle(0x314353, 0.24);
    this.launchGround.fillEllipse(0, padY + 60, 210, 24);
  }

  createRocket() {
    const bounds = this.stats.bounds || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const center = getBuildCenter(bounds);

    this.rocket = this.add.container(0, 0).setDepth(20);
    this.exhaust = this.add.graphics().setDepth(19);
    this.exhaustSmoke = this.add.graphics().setDepth(18);

    this.build.forEach((part) => {
      const definition = PARTS_BY_ID[part.partId];
      if (!definition) {
        return;
      }

      this.rocket.add(
        new ShipPart(
          this,
          (part.cellX + definition.gridWidth / 2 - center.x) * ROCKET_CELL_SIZE,
          (part.cellY + definition.gridHeight / 2 - center.y) * ROCKET_CELL_SIZE,
          definition,
          {
            cellSize: ROCKET_CELL_SIZE,
            padding: 0,
            showLabel: false,
            showPlate: false,
          },
        ),
      );
    });
  }

  createHud() {
    this.hud = new FlightHud(this, {
      onEngineToggle: () => this.toggleEngine(),
    });
    this.hud.create();
  }

  createMissionOverlay() {
    const { width, height } = this.scale;

    this.resultOverlay = this.add.container(0, 0).setDepth(120).setVisible(false);
    this.resultShade = this.add
      .rectangle(width / 2, height / 2, width, height, 0x030811, 0.62)
      .setScrollFactor(0);
    this.resultPanel = this.add
      .rectangle(width / 2, height / 2, 660, 360, 0x081624, 0.96)
      .setStrokeStyle(2, 0x73f7c0, 0.42)
      .setScrollFactor(0);
    this.resultTitle = this.add
      .text(width / 2, height / 2 - 118, "", {
        fontSize: "42px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.resultBody = this.add
      .text(width / 2, height / 2 - 66, "", {
        fontSize: "20px",
        color: "#d7efff",
        align: "center",
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.resultStats = this.add
      .text(width / 2, height / 2 + 16, "", {
        fontSize: "20px",
        color: "#effcff",
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.resultHint = this.add
      .text(width / 2, height / 2 + 104, "R rebuild    SPACE relaunch", {
        fontSize: "18px",
        color: "#8fd7ff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.resultBuildButton = this.createOverlayButton(
      width / 2 - 144,
      height / 2 + 138,
      "Back To Hangar",
      0x68d9ff,
      () => this.returnToBuild(),
    );
    this.resultRetryButton = this.createOverlayButton(
      width / 2 + 12,
      height / 2 + 138,
      "Launch Again",
      0x73f7c0,
      () => this.restartFlight(),
    );

    this.resultOverlay.add([
      this.resultShade,
      this.resultPanel,
      this.resultTitle,
      this.resultBody,
      this.resultStats,
      this.resultHint,
      this.resultBuildButton.container,
      this.resultRetryButton.container,
    ]);

    this.layoutMissionOverlay(width, height);
  }

  createOverlayButton(x, y, label, accent, callback) {
    const container = this.add.container(0, 0).setScrollFactor(0);
    const background = this.add
      .rectangle(x, y, 252, 56, 0x102233, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(2, accent, 0.72)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    const text = this.add
      .text(x + 126, y + 28, label, {
        fontSize: "18px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    background.on("pointerdown", callback);
    background.on("pointerover", () => background.setStrokeStyle(2, accent, 1));
    background.on("pointerout", () => background.setStrokeStyle(2, accent, 0.72));

    container.add([background, text]);
    return { container, background, text };
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    this.daySky.clear();
    this.daySky.fillGradientStyle(0x79bfff, 0x63b1f2, 0xdfefff, 0x9ccaf4, 1);
    this.daySky.fillRect(0, 0, width, height);

    this.sunGlow.setPosition(width * 0.78, height * 0.2);
    this.sunCore.setPosition(width * 0.78, height * 0.2);

    this.skyHaze.clear();
    this.skyHaze.fillStyle(0xf8fcff, 0.08);
    this.skyHaze.fillEllipse(width * 0.5, height * 0.82, width * 1.5, height * 0.34);

    this.spaceShade.clear();
    this.spaceShade.fillStyle(0x04111d, 1);
    this.spaceShade.fillRect(0, 0, width, height);

    this.stars.forEach((star) => {
      star.setPosition(
        Phaser.Math.Between(-width, width * 2),
        Phaser.Math.Between(-height, height * 2),
      );
    });

    this.hud.resize(width, height);
    this.layoutMissionOverlay(width, height);
  }

  layoutMissionOverlay(width, height) {
    const panelWidth = Math.min(660, Math.max(320, width - 80));
    const panelHeight = Math.min(360, Math.max(280, height - 100));
    const panelTop = height / 2 - panelHeight / 2;
    const buttonY = panelTop + panelHeight - 70;

    this.resultShade.setPosition(width / 2, height / 2).setSize(width, height);
    this.resultPanel
      .setPosition(width / 2, height / 2)
      .setSize(panelWidth, panelHeight);
    this.resultTitle.setPosition(width / 2, panelTop + 54);
    this.resultBody.setPosition(width / 2, panelTop + 108);
    this.resultBody.setWordWrapWidth(panelWidth - 100);
    this.resultStats.setPosition(width / 2, panelTop + 184);
    this.resultHint.setPosition(width / 2, panelTop + panelHeight - 98);

    this.layoutOverlayButton(this.resultBuildButton, width / 2 - 144, buttonY);
    this.layoutOverlayButton(this.resultRetryButton, width / 2 + 12, buttonY);
  }

  layoutOverlayButton(button, x, y) {
    button.background.setPosition(x, y);
    button.text.setPosition(x + 126, y + 28);
  }

  registerInput() {
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("wheel", this.handleMouseWheel, this);
    this.input.keyboard.on("keydown-H", this.onToggleHelp);
    this.input.keyboard.on("keydown-R", this.onResultRebuild);
    this.input.keyboard.on("keydown-SPACE", this.onResultRelaunch);
    this.input.keyboard.on("keydown-ESC", this.onEscapeToBuild);
  }

  handleShutdown() {
    this.scale.off("resize", this.handleResize, this);
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.input.off("pointermove", this.handlePointerMove, this);
    this.input.off("pointerup", this.handlePointerUp, this);
    this.input.off("wheel", this.handleMouseWheel, this);
    this.input.keyboard.off("keydown-H", this.onToggleHelp);
    this.input.keyboard.off("keydown-R", this.onResultRebuild);
    this.input.keyboard.off("keydown-SPACE", this.onResultRelaunch);
    this.input.keyboard.off("keydown-ESC", this.onEscapeToBuild);
  }

  handlePointerDown(pointer) {
    if (!pointer.rightButtonDown() && !pointer.middleButtonDown()) {
      return;
    }

    this.cameraDrag = {
      pointerId: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      originPanX: this.cameraState.panX,
      originPanY: this.cameraState.panY,
    };
  }

  handlePointerMove(pointer) {
    if (!this.cameraDrag || this.cameraDrag.pointerId !== pointer.id) {
      return;
    }

    const zoom = Math.max(this.cameraState.zoom, 0.001);
    this.cameraState.panX =
      this.cameraDrag.originPanX - (pointer.x - this.cameraDrag.startX) / zoom;
    this.cameraState.panY =
      this.cameraDrag.originPanY - (pointer.y - this.cameraDrag.startY) / zoom;
  }

  handlePointerUp(pointer) {
    if (this.cameraDrag?.pointerId === pointer.id) {
      this.cameraDrag = null;
    }
  }

  handleMouseWheel(pointer, over, deltaX, deltaY) {
    this.cameraState.zoomFactor = Phaser.Math.Clamp(
      this.cameraState.zoomFactor + (deltaY > 0 ? -0.08 : 0.08),
      0.72,
      1.8,
    );
  }

  update(time, delta) {
    this.updateControls(delta);

    const state = this.simulator.update(delta, this.controls);
    const prediction = this.simulator.predictPath(state);

    this.renderFlight(state, prediction, time, delta);
    this.updateHud(state, prediction);
    this.handleMissionEnd(state);
  }

  updateControls(delta) {
    if (this.finished) {
      this.controls.steer = 0;
      this.controls.throttle = 0;
      return;
    }

    if (
      Phaser.Input.Keyboard.JustDown(this.keys.space) ||
      Phaser.Input.Keyboard.JustDown(this.keys.f)
    ) {
      this.toggleEngine();
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
    this.controls.throttle = this.controls.engineOn
      ? this.keys.shift.isDown
        ? 1
        : this.controls.cruiseThrottle
      : 0;
  }

  toggleEngine() {
    this.controls.engineOn = !this.controls.engineOn;
  }

  renderFlight(state, prediction, time, delta) {
    this.updateTrail(state);
    this.updateGuidance(prediction);
    this.updateCamera(state);
    this.updateWorldVisuals(state);
    this.updateRocketPose(state);
    this.updateExhaust(state, time, delta);
    this.updateLaunchMomentum(state, time);
  }

  updateHud(state, prediction) {
    this.hud.update(state, {
      stats: this.stats,
      predictionSummary: prediction,
    });
  }

  handleMissionEnd(state) {
    if (this.finished || !state.result) {
      return;
    }

    this.finished = true;
    this.controls.engineOn = false;
    this.controls.throttle = 0;
    this.controls.steer = 0;

    const snapshot = {
      result: state.result,
      reason: state.reason,
      altitude: state.altitude,
      horizontalVelocity: Math.abs(state.horizontalVelocity),
      time: state.time,
    };

    this.time.delayedCall(state.result === "success" ? 900 : 1200, () => {
      this.showMissionOverlay(snapshot);
    });
  }

  showMissionOverlay(resultData) {
    const success = resultData.result === "success";
    const accent = success ? "#9ef6ca" : "#ffb0b0";
    const accentStroke = success ? 0x73f7c0 : 0xff8d8d;

    this.resultTitle.setText(success ? "Orbit Reached" : "Mission Failed");
    this.resultTitle.setColor(accent);
    this.resultBody.setText(resultData.reason);
    this.resultStats.setText(
      [
        `Peak altitude: ${resultData.altitude.toFixed(1)} km`,
        `Horizontal speed: ${resultData.horizontalVelocity.toFixed(2)} km/s`,
        `Flight time: ${resultData.time.toFixed(1)} s`,
        `Launch TWR: ${(this.stats.twr || 0).toFixed(2)}`,
      ].join("\n"),
    );
    this.resultPanel.setStrokeStyle(2, accentStroke, 0.42);
    this.resultOverlay.setVisible(true);
    this.resultOverlayVisible = true;
  }

  restartFlight() {
    this.scene.restart({ build: this.build, stats: this.stats });
  }

  returnToBuild() {
    this.scene.start("BuildScene", { build: this.build });
  }

  getPresentationAltitude(altitude) {
    const earlyProgress = Phaser.Math.Clamp(
      altitude / LAUNCH_PRESENTATION_ALTITUDE,
      0,
      1,
    );
    return altitude * Phaser.Math.Linear(2.4, 1, earlyProgress);
  }

  getRenderPosition(state) {
    const altitude = this.getPresentationAltitude(state.altitude);
    return {
      x: state.position.x,
      y: state.position.y - (altitude - state.altitude),
      altitude,
    };
  }

  updateCamera(state) {
    const renderPosition = this.getRenderPosition(state);
    const altitudeProgress = Phaser.Math.Clamp(
      renderPosition.altitude / FLIGHT_WORLD.targetOrbitAltitude,
      0,
      1,
    );
    const orbitBlend = Phaser.Math.Clamp(
      (renderPosition.altitude - ORBIT_CAMERA_START_ALTITUDE) /
        (ORBIT_CAMERA_END_ALTITUDE - ORBIT_CAMERA_START_ALTITUDE),
      0,
      1,
    );
    const viewRadius = Phaser.Math.Linear(
      FLIGHT_WORLD.planetRadius + 80,
      FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude + 80,
      altitudeProgress,
    );
    const orbitalZoom = Phaser.Math.Clamp(
      (Math.min(this.scale.width, this.scale.height) * 0.42) / viewRadius,
      MIN_ORBIT_CAMERA_ZOOM,
      1.72,
    );
    const launchLockProgress = Phaser.Math.Clamp(state.altitude / 42, 0, 1);
    const framingY = Phaser.Math.Linear(42, 88, orbitBlend);
    const desiredCenterX = renderPosition.x + this.cameraState.panX;
    const launchCenterY = -FLIGHT_WORLD.planetRadius + 10 + this.cameraState.panY;
    const followCenterY = renderPosition.y + framingY + this.cameraState.panY;
    const desiredCenterY = Phaser.Math.Linear(
      launchCenterY,
      followCenterY,
      launchLockProgress,
    );
    const desiredZoom = Phaser.Math.Clamp(
      Phaser.Math.Linear(INITIAL_CAMERA_ZOOM, orbitalZoom, orbitBlend) *
        this.cameraState.zoomFactor,
      0.34,
      2.2,
    );
    const cameraFollow = Phaser.Math.Linear(0.18, 0.1, orbitBlend);

    this.cameraState.centerX = Phaser.Math.Linear(
      this.cameraState.centerX,
      desiredCenterX,
      cameraFollow,
    );
    this.cameraState.centerY = Phaser.Math.Linear(
      this.cameraState.centerY,
      desiredCenterY,
      cameraFollow,
    );
    this.cameraState.zoom = Phaser.Math.Linear(
      this.cameraState.zoom,
      desiredZoom,
      0.16,
    );

    this.cameras.main.centerOn(
      this.cameraState.centerX,
      this.cameraState.centerY,
    );
    this.cameras.main.setZoom(this.cameraState.zoom);
  }

  updateWorldVisuals(state) {
    const dayToSpace = Phaser.Math.Clamp(
      (state.altitude - DAY_SKY_FADE_START_ALTITUDE) /
        (DAY_SKY_FADE_END_ALTITUDE - DAY_SKY_FADE_START_ALTITUDE),
      0,
      1,
    );
    const overlayProgress = Phaser.Math.Clamp(
      (state.altitude - GUIDANCE_REVEAL_ALTITUDE) / 150,
      0,
      1,
    );
    const planetReveal = Phaser.Math.Clamp(
      (state.altitude - PLANET_REVEAL_ALTITUDE) / 120,
      0,
      1,
    );
    const padFade = Phaser.Math.Clamp(
      1 - state.altitude / PAD_FADE_ALTITUDE,
      0,
      1,
    );

    this.spaceShade.setAlpha(Phaser.Math.Linear(0, 0.96, dayToSpace));
    this.sunGlow.setAlpha(Phaser.Math.Linear(0.34, 0.08, dayToSpace));
    this.sunCore.setAlpha(Phaser.Math.Linear(0.9, 0.28, dayToSpace));
    this.skyHaze.setAlpha(Phaser.Math.Linear(1, 0.06, dayToSpace));
    this.stars.forEach((star) => {
      star.setAlpha(Phaser.Math.Linear(0, 1, dayToSpace));
    });

    this.orbitBand.setAlpha(Phaser.Math.Linear(0.02, 0.28, overlayProgress));
    this.orbitGuides.setAlpha(Phaser.Math.Linear(0.04, 0.56, overlayProgress));
    this.horizonGlow.setAlpha(planetReveal * 0.42);
    this.highAltitudeHorizon.setAlpha(planetReveal * 0.74);
    this.launchBackdrop.setAlpha(Phaser.Math.Linear(0.9, 0, 1 - padFade));
    this.launchGround.setAlpha(Phaser.Math.Linear(1, 0, 1 - padFade));
    this.pad.setAlpha(0.12 + padFade * 0.72);

    this.padGlow.clear();
    if (state.engineOn && state.throttle > 0 && padFade > 0.05) {
      this.padGlow.fillStyle(0xff9d5c, state.throttle * padFade * 0.16);
      this.padGlow.fillEllipse(0, -FLIGHT_WORLD.planetRadius + 44, 220, 54);
    }

  }

  updateTrail(state) {
    if (!state.launched && this.flightTrail.length === 0) {
      return;
    }

    this.flightTrail.push({ x: state.position.x, y: state.position.y });
    if (this.flightTrail.length > TRAIL_LIMIT) {
      this.flightTrail.shift();
    }

    this.trailGraphics.clear();
    if (this.flightTrail.length < 2) {
      return;
    }

    this.trailGraphics.lineStyle(2, 0xffd773, 0.44);
    this.trailGraphics.beginPath();
    this.trailGraphics.moveTo(this.flightTrail[0].x, this.flightTrail[0].y);
    for (let index = 1; index < this.flightTrail.length; index += 1) {
      this.trailGraphics.lineTo(
        this.flightTrail[index].x,
        this.flightTrail[index].y,
      );
    }
    this.trailGraphics.strokePath();
  }

  updateGuidance(prediction) {
    this.trajectoryGraphics.clear();
    this.markerGraphics.clear();

    if (prediction.apoapsis < GUIDANCE_REVEAL_ALTITUDE) {
      return;
    }

    prediction.points.forEach((point, index) => {
      const progress = index / Math.max(prediction.points.length - 1, 1);
      this.trajectoryGraphics.fillStyle(0x8fd7ff, 0.08 + progress * 0.22);
      this.trajectoryGraphics.fillCircle(point.x, point.y, 1.4 + progress);
    });

    if (prediction.apoapsisPoint) {
      this.markerGraphics.lineStyle(1.5, 0xffd773, 0.84);
      this.markerGraphics.strokeCircle(
        prediction.apoapsisPoint.x,
        prediction.apoapsisPoint.y,
        8,
      );
    }

    if (prediction.corridorPoint) {
      this.markerGraphics.lineStyle(1.5, 0x73f7c0, 0.84);
      this.markerGraphics.strokeCircle(
        prediction.corridorPoint.x,
        prediction.corridorPoint.y,
        6,
      );
    }
  }

  updateRocketPose(state) {
    const renderPosition = this.getRenderPosition(state);
    const launchPoseProgress = Phaser.Math.Clamp(
      (state.altitude - 34) / 110,
      0,
      1,
    );
    const targetRotation = state.orientation + Math.PI / 2;

    this.rocket.x = renderPosition.x;
    this.rocket.y = renderPosition.y;
    this.rocket.rotation =
      angleDifference(targetRotation, 0) * launchPoseProgress;
  }

  updateLaunchMomentum(state, time) {
    const renderPosition = this.getRenderPosition(state);
    const launchBoost = Phaser.Math.Clamp(
      (LAUNCH_BURST_ALTITUDE - state.altitude) / LAUNCH_BURST_ALTITUDE,
      0,
      1,
    ) * state.throttle;

    this.launchSpeedLines.clear();

    if (state.launched && !this.launchBurstPlayed) {
      this.launchBurstPlayed = true;
      this.cameras.main.shake(180, 0.0032);
    }

    if (launchBoost <= 0.04) {
      return;
    }

    for (let index = 0; index < LAUNCH_SPEED_LINE_COUNT; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const spread = 26 + Math.floor(index / 2) * 18;
      const wave = Math.sin(time / 70 + index * 0.9) * 4;
      const startX = renderPosition.x + side * spread;
      const startY = renderPosition.y + 18 + index * 4;
      const endX = startX + side * (14 + launchBoost * 18);
      const endY = startY + 24 + launchBoost * 38 + wave;

      this.launchSpeedLines.lineStyle(
        2,
        0xf8fcff,
        launchBoost * (0.18 + index * 0.03),
      );
      this.launchSpeedLines.beginPath();
      this.launchSpeedLines.moveTo(startX, startY);
      this.launchSpeedLines.lineTo(endX, endY);
      this.launchSpeedLines.strokePath();
    }
  }

  updateExhaust(state, time, delta) {
    const renderPosition = this.getRenderPosition(state);
    const thrustVisual =
      state.engineOn && state.fuelRemaining > 0 ? state.throttle : 0;
    const groundBoost = Phaser.Math.Clamp(
      (80 - state.altitude) / 80,
      0,
      1,
    );
    const flameLength =
      thrustVisual > 0
        ? 34 +
          Math.sin(time / 70) * 6 +
          thrustVisual * 26 +
          groundBoost * thrustVisual * 28
        : 0;

    this.exhaust.clear();
    this.exhaustSmoke.clear();
    this.updateSmoke(state, delta, renderPosition);

    if (flameLength <= 0) {
      return;
    }

    this.drawExhaustFlame(state.orientation, renderPosition, thrustVisual, flameLength);
  }

  drawExhaustFlame(orientation, renderPosition, thrustVisual, flameLength) {
    const rearAngle = orientation + Math.PI / 2;
    const rearX = renderPosition.x - Math.cos(orientation) * 28;
    const rearY = renderPosition.y - Math.sin(orientation) * 28;
    const sideX = Math.cos(rearAngle) * 10;
    const sideY = Math.sin(rearAngle) * 10;
    const tailX = rearX - Math.cos(orientation) * flameLength;
    const tailY = rearY - Math.sin(orientation) * flameLength;

    this.exhaust.fillStyle(0xfff4bf, 0.95);
    this.exhaust.fillCircle(rearX, rearY, 8 + thrustVisual * 5);
    this.exhaust.fillStyle(0xffb057, 0.82);
    this.exhaust.fillTriangle(
      rearX + sideX,
      rearY + sideY,
      rearX - sideX,
      rearY - sideY,
      tailX,
      tailY,
    );
    this.exhaust.fillStyle(0xff7d38, 0.58);
    this.exhaust.fillTriangle(
      rearX + sideX * 1.8,
      rearY + sideY * 1.8,
      rearX - sideX * 1.8,
      rearY - sideY * 1.8,
      tailX - Math.cos(orientation) * (18 + thrustVisual * 18),
      tailY - Math.sin(orientation) * (18 + thrustVisual * 18),
    );
  }

  updateSmoke(state, delta, renderPosition) {
    const thrustVisual =
      state.engineOn && state.fuelRemaining > 0 ? state.throttle : 0;
    const groundBoost = Phaser.Math.Clamp(
      (90 - state.altitude) / 90,
      0,
      1,
    );
    const rearX = renderPosition.x - Math.cos(state.orientation) * 28;
    const rearY = renderPosition.y - Math.sin(state.orientation) * 28;
    const amount = Math.round(
      Phaser.Math.Clamp(
        thrustVisual * (1.4 + state.atmosphereDensity * 2.6 + groundBoost * 1.8),
        0,
        6,
      ),
    );

    this.spawnSmoke(state.orientation, rearX, rearY, amount);
    this.renderSmoke(delta / 1000);
  }

  spawnSmoke(orientation, rearX, rearY, amount) {
    for (let index = 0; index < amount; index += 1) {
      this.smokeTrail.push({
        x: rearX + Phaser.Math.Between(-3, 3),
        y: rearY + Phaser.Math.Between(-3, 3),
        vx: -Math.cos(orientation) * Phaser.Math.FloatBetween(0.4, 1.1),
        vy: -Math.sin(orientation) * Phaser.Math.FloatBetween(0.4, 1.1),
        size: Phaser.Math.FloatBetween(8, 12),
        growth: Phaser.Math.FloatBetween(18, 28),
        life: Phaser.Math.FloatBetween(0.35, 0.75),
        maxLife: 0.75,
      });
    }
  }

  renderSmoke(lifeStep) {
    this.smokeTrail = this.smokeTrail.filter((puff) => {
      puff.life -= lifeStep;
      puff.x += puff.vx;
      puff.y += puff.vy;
      puff.size += puff.growth * lifeStep;

      if (puff.life <= 0) {
        return false;
      }

      const alpha = Phaser.Math.Clamp(puff.life / puff.maxLife, 0, 1);
      this.exhaustSmoke.fillStyle(0xc9d2d9, alpha * 0.1);
      this.exhaustSmoke.fillCircle(puff.x, puff.y, puff.size);
      this.exhaustSmoke.fillStyle(0x5d6771, alpha * 0.18);
      this.exhaustSmoke.fillCircle(puff.x, puff.y, puff.size * 0.72);
      return true;
    });
  }
}
