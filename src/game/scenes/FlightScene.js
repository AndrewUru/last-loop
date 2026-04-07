import Phaser from "phaser";
import ShipPart from "../entities/ShipPart.js";
import ShipStatsCalculator from "../systems/ShipStatsCalculator.js";
import FlightSimulator, {
  FLIGHT_TARGETS,
  FLIGHT_WORLD,
} from "../systems/FlightSimulator.js";
import ThreeFlightBackdrop from "../systems/ThreeFlightBackdrop.js";
import { PARTS_BY_ID } from "../data/parts.js";

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

export default class FlightScene extends Phaser.Scene {
  constructor() {
    super({ key: "FlightScene" });
  }

  init(data) {
    this.build = data.build || this.registry.get("rocket-build") || [];
    this.stats = data.stats || ShipStatsCalculator.calculate(this.build);
  }

  create() {
    this.simulator = new FlightSimulator(this.stats);
    this.finished = false;
    this.missionPhaseId = null;
    this.flightTrail = [];
    this.smokeTrail = [];
    this.padSmokeTrail = [];
    this.uiObjects = [];
    this.manualZoomOffset = 0;
    this.zoomSettings = {
      min: 0.28,
      max: 2.2,
      step: 0.09,
      wheelStep: 0.06,
    };
    this.input.mouse?.disableContextMenu();
    this.controls = {
      cruiseThrottle: 0.84,
      throttle: 0,
      engineOn: false,
      steer: 0,
      source: "Pad",
    };
    this.flightKeys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      f: Phaser.Input.Keyboard.KeyCodes.F,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
      e: Phaser.Input.Keyboard.KeyCodes.E,
      r: Phaser.Input.Keyboard.KeyCodes.R,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    });

    this.setupThreeBackdrop();
    this.createSpaceBackdrop();
    this.createOrbitalWorld();
    this.createLaunchComplex();
    this.createRocket();
    this.createHud();
    this.setupUiCamera();

    this.cameraRig = {
      x: 0,
      y: -(FLIGHT_WORLD.planetRadius + 40),
      zoom: 1.95,
    };
    this.worldCamera.centerOn(this.cameraRig.x, this.cameraRig.y);
    this.worldCamera.setZoom(this.cameraRig.zoom);
    this.input.on("wheel", this.handleWheelZoom, this);

    this.input.keyboard.on("keydown-ESC", () => {
      this.fadeOutScene(400);
      this.time.delayedCall(420, () => {
        this.scene.start("BuildScene", { build: this.build });
      });
    });

    this.events.once("shutdown", () => {
      this.teardownThreeBackdrop();
    });
    this.events.once("destroy", () => {
      this.teardownThreeBackdrop();
    });
  }

  setupThreeBackdrop() {
    const parent = document.getElementById("game-container");
    if (!parent) {
      return;
    }

    this.game.canvas.style.position = "absolute";
    this.game.canvas.style.inset = "0";
    this.game.canvas.style.zIndex = "2";
    this.game.canvas.style.background = "transparent";

    this.threeBackdrop = new ThreeFlightBackdrop({
      parent,
      width: this.scale.width,
      height: this.scale.height,
    });

    this.scale.on("resize", this.handleResize, this);
  }

  setupUiCamera() {
    this.worldCamera = this.cameras.main;
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);
    this.uiCamera.setBackgroundColor("rgba(0,0,0,0)");
    this.uiCamera.ignore(this.getWorldObjects());
    this.worldCamera.ignore(this.uiObjects);
    this.layoutHud();
  }

  teardownThreeBackdrop() {
    this.scale.off("resize", this.handleResize, this);
    this.input.off("wheel", this.handleWheelZoom, this);
    this.threeBackdrop?.destroy();
    this.threeBackdrop = null;
  }

  handleResize(gameSize) {
    this.threeBackdrop?.resize(gameSize.width, gameSize.height);
    this.worldCamera?.setSize(gameSize.width, gameSize.height);
    this.uiCamera?.setSize(gameSize.width, gameSize.height);
    this.uiCamera?.setViewport(0, 0, gameSize.width, gameSize.height);
    this.layoutHud(gameSize.width, gameSize.height);
  }

  createSpaceBackdrop() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");

    this.nebula = this.add.graphics().setScrollFactor(0).setDepth(-100);
    this.nebula.fillStyle(0x122c47, 0.14);
    this.nebula.fillCircle(width * 0.78, height * 0.22, 180);
    this.nebula.fillStyle(0xff8e54, 0.1);
    this.nebula.fillCircle(width * 0.25, height * 0.78, 220);

    this.stars = Array.from({ length: 120 }, () =>
      this.add
        .circle(
          Phaser.Math.Between(-width, width * 2),
          Phaser.Math.Between(-height, height * 2),
          Phaser.Math.FloatBetween(1, 2.8),
          Phaser.Math.Between(0xb8daff, 0xffffff),
          Phaser.Math.FloatBetween(0.04, 0.22),
        )
        .setScrollFactor(0.05)
        .setDepth(-90),
    );
  }

  createOrbitalWorld() {
    this.orbitGraphics = this.add.graphics().setDepth(-20);
    this.trailGraphics = this.add.graphics().setDepth(11);
    this.planetAtmosphere = this.add.graphics().setDepth(-18);
    this.planetBody = this.add.graphics().setDepth(-17);
    this.planetDetails = this.add.graphics().setDepth(-16);
    this.launchMarker = this.add.graphics().setDepth(-15);

    this.drawPlanet();
    this.drawOrbitGuides();
    this.orbitGraphics.setAlpha(0.04);
    this.planetAtmosphere.setAlpha(0.02);
    this.planetBody.setAlpha(0.01);
    this.planetDetails.setAlpha(0.01);
    this.launchMarker.setAlpha(0.02);
  }

  createLaunchComplex() {
    const padY = -FLIGHT_WORLD.planetRadius;
    this.launchSky = this.add.graphics().setDepth(-14);
    this.launchGround = this.add.graphics().setDepth(-13);
    this.launchHorizon = this.add.graphics().setDepth(-12);
    this.launchPad = this.add.container(0, 0).setDepth(12);
    this.launchPadSmoke = this.add.graphics().setDepth(12);
    this.launchPadGlow = this.add.graphics().setDepth(13);
    this.drawLaunchLandscape();

    const deck = this.add.rectangle(0, padY + 36, 320, 38, 0x31424f, 0.96);
    const deckTop = this.add.rectangle(0, padY + 24, 348, 14, 0x5c7388, 0.96);
    const trench = this.add.rectangle(0, padY + 52, 92, 30, 0x101820, 0.95);
    const gantry = this.add.rectangle(68, padY - 118, 34, 276, 0x465868, 0.98);
    const gantryCore = this.add.rectangle(68, padY - 118, 14, 276, 0x70859c, 0.95);
    const serviceArmTop = this.add.rectangle(26, padY - 176, 90, 12, 0x6f8298, 0.95);
    const serviceArmMid = this.add.rectangle(20, padY - 114, 76, 10, 0x6b7a8d, 0.92);
    const serviceArmLow = this.add.rectangle(16, padY - 42, 58, 10, 0x637487, 0.9);
    const clampLeft = this.add.rectangle(-26, padY + 8, 18, 44, 0x5d6d7e, 0.95);
    const clampRight = this.add.rectangle(26, padY + 8, 18, 44, 0x5d6d7e, 0.95);
    const towerLightA = this.add.circle(68, padY - 212, 5, 0xffe3a1, 0.9);
    const towerLightB = this.add.circle(68, padY - 164, 4, 0xff9b7a, 0.85);

    this.launchPad.add([
      deck,
      deckTop,
      trench,
      gantry,
      gantryCore,
      serviceArmTop,
      serviceArmMid,
      serviceArmLow,
      clampLeft,
      clampRight,
      towerLightA,
      towerLightB,
    ]);

    this.horizonClouds = this.add.container(0, 0).setDepth(10);
    const cloudOffsets = [
      { x: -150, y: padY + 92, width: 148, height: 54, alpha: 0.2 },
      { x: -72, y: padY + 78, width: 168, height: 60, alpha: 0.24 },
      { x: 56, y: padY + 88, width: 176, height: 64, alpha: 0.2 },
      { x: 168, y: padY + 100, width: 136, height: 48, alpha: 0.14 },
    ];

    cloudOffsets.forEach((cloud) => {
      const puff = this.add.ellipse(
        cloud.x,
        cloud.y,
        cloud.width,
        cloud.height,
        0xffffff,
        cloud.alpha,
      );
      this.horizonClouds.add(puff);
    });
  }

  drawLaunchLandscape() {
    const padY = -FLIGHT_WORLD.planetRadius;
    const horizonY = padY + 74;

    this.launchSky.clear();
    this.launchSky.fillGradientStyle(0x79bff4, 0x79bff4, 0xa7d7ff, 0xd8efff, 1);
    this.launchSky.fillRect(-1400, padY - 680, 2800, 760);

    this.launchHorizon.clear();
    this.launchHorizon.fillStyle(0x8a8375, 0.98);
    this.launchHorizon.fillRect(-1400, horizonY, 2800, 82);
    this.launchHorizon.fillStyle(0x7e786d, 0.7);
    this.launchHorizon.fillRect(-1400, horizonY + 12, 2800, 12);
    this.launchHorizon.fillStyle(0x4b8f49, 0.9);
    this.launchHorizon.fillRect(-1400, horizonY + 74, 2800, 10);

    this.launchGround.clear();
    this.launchGround.fillStyle(0x766c5f, 1);
    this.launchGround.fillRect(-1400, horizonY + 82, 2800, 320);
    this.launchGround.fillStyle(0x6a6156, 0.55);
    this.launchGround.fillRect(-1400, horizonY + 108, 2800, 24);
  }

  drawPlanet() {
    const radius = FLIGHT_WORLD.planetRadius;

    this.planetAtmosphere.clear();
    this.planetAtmosphere.fillStyle(0x4fc3ff, 0.08);
    this.planetAtmosphere.fillCircle(
      0,
      0,
      radius + FLIGHT_WORLD.atmosphereHeight + 16,
    );
    this.planetAtmosphere.lineStyle(3, 0x6fd4ff, 0.28);
    this.planetAtmosphere.strokeCircle(
      0,
      0,
      radius + FLIGHT_WORLD.atmosphereHeight,
    );

    this.planetBody.clear();
    this.planetBody.fillStyle(0x0d2840, 1);
    this.planetBody.fillCircle(0, 0, radius);
    this.planetBody.fillStyle(0x143f61, 1);
    this.planetBody.fillCircle(-34, -42, radius * 0.82);

    this.planetDetails.clear();
    this.planetDetails.fillStyle(0x1c644b, 0.85);
    this.planetDetails.fillEllipse(-42, -18, 120, 68);
    this.planetDetails.fillEllipse(58, 36, 132, 78);
    this.planetDetails.fillStyle(0xffffff, 0.16);
    this.planetDetails.fillCircle(-70, -82, 42);

    this.launchMarker.clear();
    this.launchMarker.fillStyle(0xffd773, 1);
    this.launchMarker.fillTriangle(
      -10,
      -radius - 2,
      10,
      -radius - 2,
      0,
      -radius - 18,
    );
  }

  drawOrbitGuides() {
    const targetRadius =
      FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude;
    const escapeRadius =
      FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.earthEscapeAltitude;

    this.orbitGraphics.clear();
    this.orbitGraphics.lineStyle(2, 0x68d9ff, 0.22);
    this.orbitGraphics.strokeCircle(
      0,
      0,
      FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.atmosphereHeight,
    );
    this.orbitGraphics.lineStyle(3, 0x73f7c0, 0.34);
    this.orbitGraphics.strokeCircle(0, 0, targetRadius);
    this.orbitGraphics.lineStyle(2, 0xffd98a, 0.25);
    this.orbitGraphics.strokeCircle(0, 0, escapeRadius);
    this.orbitGraphics.lineStyle(1, 0xffffff, 0.1);
    this.orbitGraphics.strokeCircle(0, 0, targetRadius - 28);
    this.orbitGraphics.strokeCircle(0, 0, targetRadius + 28);
  }

  createRocket() {
    const bounds = this.stats.bounds || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const cellSize = 56;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = bounds.maxY;

    this.rocket = this.add.container(0, 0).setDepth(15);
    this.exhaustSmoke = this.add.graphics().setDepth(13);
    this.exhaust = this.add.graphics().setDepth(14);

    this.build.forEach((part) => {
      const definition = PARTS_BY_ID[part.partId];
      const sprite = new ShipPart(
        this,
        (part.cellX + definition.gridWidth / 2 - centerX) * cellSize,
        (part.cellY + definition.gridHeight / 2 - centerY) * cellSize,
        definition,
        {
          cellSize,
          padding: 8,
          showLabel: false,
          showPlate: false,
        },
      );
      this.rocket.add(sprite);
    });
  }

  createHud() {
    this.leftHudShadow = this.add
      .rectangle(0, 0, 316, 306, 0x000000, 0.3)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68d9ff, 0.1)
      .setDepth(39);

    this.leftHud = this.add
      .rectangle(0, 0, 316, 306, 0x081624, 0.95)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68d9ff, 0.35)
      .setDepth(40);
    this.telemetryTitle = this.add
      .text(0, 0, "Orbital Telemetry", {
        fontSize: "30px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(41);
    this.controlsHint = this.add
      .text(
        0,
        0,
        [
          "Keyboard Flight Controls",
          "[F/Space] Engine  [Shift] Full burn",
          "[A/D or arrows] Steer  [W/S or arrows] Cruise",
          "[Wheel or Q/E] Zoom  [R] Reset view  [Esc] Return",
          "Mouse stays UI-only during flight",
        ].join("\n"),
        {
          fontSize: "14px",
          color: "#8fd7ff",
          lineSpacing: 4,
          wordWrap: { width: 280 },
        },
      )
      .setScrollFactor(0)
      .setDepth(41);
    this.metricsText = this.add
      .text(0, 0, "", {
        fontSize: "17px",
        color: "#d8f7ff",
        lineSpacing: 9,
      })
      .setScrollFactor(0)
      .setDepth(41);

    this.rightHudShadow = this.add
      .rectangle(0, 0, 316, 306, 0x000000, 0.3)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68d9ff, 0.1)
      .setDepth(39);

    this.rightHud = this.add
      .rectangle(0, 0, 316, 306, 0x081624, 0.95)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68d9ff, 0.35)
      .setDepth(40);
    this.progressText = this.add
      .text(0, 0, "", {
        fontSize: "17px",
        color: "#d8f7ff",
        lineSpacing: 9,
        wordWrap: { width: 280 },
      })
      .setScrollFactor(0)
      .setDepth(41);

    this.phaseBannerShadow = this.add
      .rectangle(0, 0, 420, 88, 0x000000, 0.22)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x73f7c0, 0.08)
      .setDepth(40);
    this.phaseBanner = this.add
      .rectangle(0, 0, 420, 88, 0x091824, 0.94)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x73f7c0, 0.4)
      .setDepth(41);
    this.phaseBannerTitle = this.add
      .text(0, 0, "", {
        fontSize: "22px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(42);
    this.phaseBannerBody = this.add
      .text(0, 0, "", {
        fontSize: "15px",
        color: "#a9dcf5",
        align: "center",
        wordWrap: { width: 360 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(42);

    this.engineButtonShadow = this.add
      .rectangle(0, 0, 240, 52, 0x000000, 0.25)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x73f7c0, 0.1)
      .setDepth(41)
      .setInteractive({ useHandCursor: true });

    this.engineButton = this.add
      .rectangle(0, 0, 240, 52, 0x163248, 0.96)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x73f7c0, 0.6)
      .setDepth(42)
      .setInteractive({ useHandCursor: true });
    this.engineButtonLabel = this.add
      .text(0, 0, "Ignite Engine", {
        fontSize: "20px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(43);

    this.uiObjects.push(
      this.leftHudShadow,
      this.leftHud,
      this.telemetryTitle,
      this.controlsHint,
      this.metricsText,
      this.rightHudShadow,
      this.rightHud,
      this.progressText,
      this.phaseBannerShadow,
      this.phaseBanner,
      this.phaseBannerTitle,
      this.phaseBannerBody,
      this.engineButtonShadow,
      this.engineButton,
      this.engineButtonLabel,
    );

    this.layoutHud();

    this.engineButton.on("pointerdown", () => {
      this.toggleEngine();
    });
    this.engineButton.on("pointerover", () => {
      this.engineButton.setStrokeStyle(2, 0x73f7c0, 1);
    });
    this.engineButton.on("pointerout", () => {
      this.updateEngineButton(this.simulator.state);
    });
  }

  layoutHud(width = this.scale.width, height = this.scale.height) {
    if (!this.leftHud) {
      return;
    }

    const panelWidth = Phaser.Math.Clamp(Math.round(width * 0.21), 250, 316);
    const panelHeight = Phaser.Math.Clamp(Math.round(height * 0.36), 230, 306);
    const sideMargin = Phaser.Math.Clamp(Math.round(width * 0.025), 22, 42);
    const topMargin = Phaser.Math.Clamp(Math.round(height * 0.05), 28, 44);
    const leftX = sideMargin + panelWidth / 2;
    const rightX = width - sideMargin - panelWidth / 2;
    const panelTop = topMargin;
    const panelCenterY = panelTop + panelHeight / 2;
    const innerLeft = leftX - panelWidth / 2 + 16;
    const innerRight = rightX - panelWidth / 2 + 16;
    const centerX = width / 2;
    const buttonWidth = Phaser.Math.Clamp(Math.round(panelWidth * 0.76), 188, 240);
    const buttonHeight = 52;
    const buttonX = leftX;
    const buttonY = Math.min(
      height - topMargin - buttonHeight / 2,
      panelTop + panelHeight + buttonHeight / 2 + 18,
    );

    this.leftHudShadow.setPosition(leftX + 2, panelCenterY + 2);
    this.leftHudShadow.setSize(panelWidth, panelHeight);
    this.leftHud.setPosition(leftX, panelCenterY);
    this.leftHud.setSize(panelWidth, panelHeight);

    this.telemetryTitle.setPosition(innerLeft, panelTop + 12);
    this.controlsHint.setPosition(innerLeft, panelTop + 48);
    this.controlsHint.setWordWrapWidth(panelWidth - 32);
    this.metricsText.setPosition(
      innerLeft,
      this.controlsHint.y + this.controlsHint.height + 14,
    );

    this.rightHudShadow.setPosition(rightX + 2, panelCenterY + 2);
    this.rightHudShadow.setSize(panelWidth, panelHeight);
    this.rightHud.setPosition(rightX, panelCenterY);
    this.rightHud.setSize(panelWidth, panelHeight);
    this.progressText.setPosition(innerRight, panelTop + 12);
    this.progressText.setWordWrapWidth(panelWidth - 32);

    const bannerWidth = Phaser.Math.Clamp(
      Math.round(width * 0.3),
      320,
      width - sideMargin * 2 - panelWidth * 2 + 40,
    );
    const clampedBannerWidth = Math.max(280, bannerWidth);
    this.phaseBannerShadow.setPosition(centerX + 2, panelTop + 42);
    this.phaseBannerShadow.setSize(clampedBannerWidth, 88);
    this.phaseBanner.setPosition(centerX, panelTop + 40);
    this.phaseBanner.setSize(clampedBannerWidth, 88);
    this.phaseBannerTitle.setPosition(centerX, panelTop + 16);
    this.phaseBannerBody.setPosition(centerX, panelTop + 32);
    this.phaseBannerBody.setWordWrapWidth(clampedBannerWidth - 44);

    this.engineButtonShadow.setPosition(buttonX + 2, buttonY + 2);
    this.engineButtonShadow.setSize(buttonWidth, buttonHeight);
    this.engineButton.setPosition(buttonX, buttonY);
    this.engineButton.setSize(buttonWidth, buttonHeight);
    this.engineButtonLabel.setPosition(buttonX, buttonY);
  }

  update(time, delta) {
    this.updatePilotControls(delta);
    const state = this.simulator.update(delta, this.controls);

    this.updateTrail(state);
    this.updateOrbitalWorldVisuals(state);
    this.updateCamera(state);
    this.updateLaunchComplex(state, delta);
    this.updateStars(state);
    this.updateRocketPose(state);
    this.updateExhaust(state, time, delta);
    this.updateMissionPhase(state);
    this.updateHud(state);
    this.updateEngineButton(state);
    this.threeBackdrop?.update(state);

    if (!this.finished && state.result) {
        this.finished = true;
      if (state.result === "success") {
        this.fadeOutScene(900);
        this.time.delayedCall(920, () => {
          this.scene.start("ResultScene", {
            build: this.build,
            stats: this.stats,
            result: state.result,
            reason: state.reason,
            altitude: state.altitude,
            horizontalVelocity: Math.abs(state.tangentialVelocity),
            time: state.time,
          });
        });
      } else {
        this.time.delayedCall(1200, () => {
          this.scene.start("ResultScene", {
            build: this.build,
            stats: this.stats,
            result: state.result,
            reason: state.reason,
            altitude: state.altitude,
            horizontalVelocity: Math.abs(state.tangentialVelocity),
            time: state.time,
          });
        });
      }
    }
  }

  updateTrail(state) {
    if (!state.launched && this.flightTrail.length === 0) {
      return;
    }

    this.flightTrail.push({
      x: state.position.x,
      y: state.position.y,
    });

    if (this.flightTrail.length > 260) {
      this.flightTrail.shift();
    }

    this.trailGraphics.clear();
    if (this.flightTrail.length < 2) {
      return;
    }

    this.trailGraphics.lineStyle(3, 0xffd773, 0.55);
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

  updateCamera(state) {
    const minViewport = Math.min(this.scale.width, this.scale.height);
    const launchCinematicProgress = Phaser.Math.Clamp(state.altitude / 60, 0, 1);
    const cinematicCenterY = state.position.y + 92;
    const orbitalCenterY = Phaser.Math.Linear(
      cinematicCenterY,
      0,
      Phaser.Math.Clamp(state.altitude / 170, 0, 1),
    );
    const targetViewRadius = Math.max(
      FLIGHT_WORLD.planetRadius + 120,
      Phaser.Math.Linear(
        FLIGHT_WORLD.planetRadius + 120,
        FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude + 90,
        Phaser.Math.Clamp(
          state.altitude / FLIGHT_WORLD.targetOrbitAltitude,
          0,
          1,
        ),
      ),
      state.radius + 70,
    );
    const orbitalZoom = Phaser.Math.Clamp(
      (minViewport * 0.45) / targetViewRadius,
      0.34,
      1.52,
    );
    const cinematicZoom = Phaser.Math.Linear(1.46, 1.2, launchCinematicProgress);
    const autoZoom = Phaser.Math.Linear(
      cinematicZoom,
      orbitalZoom,
      Phaser.Math.Clamp(state.altitude / 130, 0, 1),
    );
    const targetZoom = Phaser.Math.Clamp(
      autoZoom + this.manualZoomOffset,
      this.zoomSettings.min,
      this.zoomSettings.max,
    );
    const targetCenterX = Phaser.Math.Linear(
      state.position.x * 0.1,
      0,
      Phaser.Math.Clamp(state.altitude / 140, 0, 1),
    );
    const targetCenterY = state.altitude < 120 ? cinematicCenterY : orbitalCenterY;

    this.cameraRig.x = Phaser.Math.Linear(this.cameraRig.x, targetCenterX, 0.08);
    this.cameraRig.y = Phaser.Math.Linear(this.cameraRig.y, targetCenterY, 0.08);
    this.cameraRig.zoom = Phaser.Math.Linear(this.cameraRig.zoom, targetZoom, 0.08);

    this.worldCamera.centerOn(this.cameraRig.x, this.cameraRig.y);
    this.worldCamera.setZoom(this.cameraRig.zoom);
  }

  updateOrbitalWorldVisuals(state) {
    const orbitalOverlayProgress = Phaser.Math.Clamp(
      (state.altitude - 36) / 150,
      0,
      1,
    );
    const guideAlpha = Phaser.Math.Linear(0.04, 0.82, orbitalOverlayProgress);
    const atmosphereAlpha = Phaser.Math.Linear(
      0.02,
      0.12,
      orbitalOverlayProgress,
    );
    const planetAlpha = Phaser.Math.Linear(0.01, 0.08, orbitalOverlayProgress);
    const detailsAlpha = Phaser.Math.Linear(0.01, 0.09, orbitalOverlayProgress);

    this.orbitGraphics.setAlpha(guideAlpha);
    this.planetAtmosphere.setAlpha(atmosphereAlpha);
    this.planetBody.setAlpha(planetAlpha);
    this.planetDetails.setAlpha(detailsAlpha);
    this.launchMarker.setAlpha(Phaser.Math.Linear(0.02, 0.86, orbitalOverlayProgress));
  }

  updateLaunchComplex(state, delta) {
    const altitudeFade = Phaser.Math.Clamp(1 - state.altitude / 120, 0, 1);
    const sideViewFade = Phaser.Math.Clamp(1 - state.altitude / 95, 0, 1);
    const lifeStep = delta / 1000;
    const thrustVisual = state.engineOn && state.fuelRemaining > 0 ? state.throttle : 0;
    const padY = -FLIGHT_WORLD.planetRadius;

    this.launchSky.setAlpha(0.96 * sideViewFade);
    this.launchGround.setAlpha(sideViewFade);
    this.launchHorizon.setAlpha(sideViewFade);
    this.launchPad.setAlpha(0.18 + altitudeFade * 0.82);
    this.horizonClouds.setAlpha(0.12 + altitudeFade * 0.88);
    this.launchPadGlow.clear();
    this.launchPadSmoke.clear();

    if (altitudeFade > 0.02) {
      this.launchPadGlow.fillStyle(0xffa95a, thrustVisual * altitudeFade * 0.16);
      this.launchPadGlow.fillEllipse(0, padY + 44, 186, 52);
    }

    if (thrustVisual > 0.06 && state.altitude < 80) {
      const smokeBursts = Math.round(2 + thrustVisual * 5 + state.atmosphereDensity * 3);
      for (let index = 0; index < smokeBursts; index += 1) {
        this.padSmokeTrail.push({
          x: Phaser.Math.Between(-34, 34),
          y: padY + Phaser.Math.Between(12, 32),
          vx: Phaser.Math.FloatBetween(-0.8, 0.8),
          vy: Phaser.Math.FloatBetween(0.2, 1.4),
          size: Phaser.Math.FloatBetween(16, 28),
          growth: Phaser.Math.FloatBetween(12, 22),
          life: Phaser.Math.FloatBetween(0.4, 1),
          maxLife: 1,
        });
      }
    }

    this.padSmokeTrail = this.padSmokeTrail.filter((puff) => {
      puff.life -= lifeStep;
      puff.x += puff.vx;
      puff.y += puff.vy;
      puff.size += puff.growth * lifeStep;

      if (puff.life <= 0) {
        return false;
      }

      const alpha = Phaser.Math.Clamp(puff.life / puff.maxLife, 0, 1) * altitudeFade;
      this.launchPadSmoke.fillStyle(0xcdd6de, alpha * 0.12);
      this.launchPadSmoke.fillCircle(puff.x, puff.y, puff.size);
      this.launchPadSmoke.fillStyle(0x6f7b88, alpha * 0.18);
      this.launchPadSmoke.fillCircle(puff.x, puff.y, puff.size * 0.72);
      return alpha > 0.01;
    });
  }

  updateStars(state) {
    const altitudeProgress = Phaser.Math.Clamp(
      state.altitude / FLIGHT_WORLD.targetOrbitAltitude,
      0,
      1,
    );

    this.stars.forEach((star, index) => {
      star.alpha = 0.02 + altitudeProgress * 1.05;
      star.scale = 0.8 + altitudeProgress * 0.5 + (index % 5) * 0.03;
    });

    this.nebula.setAlpha(0.28 + altitudeProgress * 0.72);
  }

  updateRocketPose(state) {
    const launchPoseProgress = Phaser.Math.Clamp((state.altitude - 16) / 90, 0, 1);
    const targetRotation = state.orientation + Math.PI / 2;
    const renderedRotation =
      angleDifference(targetRotation, 0) * launchPoseProgress;

    this.rocket.x = state.position.x;
    this.rocket.y = state.position.y;
    this.rocket.rotation = renderedRotation;
  }

  updateExhaust(state, time, delta) {
    const engineCount = Math.max(
      this.stats.engineCount + this.stats.boosterCount,
      1,
    );
    const thrustVisual =
      state.engineOn && state.fuelRemaining > 0 ? state.throttle : 0;
    const flameLength =
      thrustVisual > 0
        ? 20 + engineCount * 9 + Math.sin(time / 65) * 6 + thrustVisual * 16
        : 0;

    this.exhaust.clear();
    this.exhaustSmoke.clear();

    this.updateSmokeTrail(state, delta);

    if (flameLength <= 0) {
      return;
    }

    const rearAngle = state.orientation + Math.PI / 2;
    const rearX = state.position.x - Math.cos(state.orientation) * 30;
    const rearY = state.position.y - Math.sin(state.orientation) * 30;
    const sideX = Math.cos(rearAngle) * 11;
    const sideY = Math.sin(rearAngle) * 11;
    const tailX = rearX - Math.cos(state.orientation) * flameLength;
    const tailY = rearY - Math.sin(state.orientation) * flameLength;

    this.exhaust.fillStyle(0xfff4bf, 0.95);
    this.exhaust.fillCircle(rearX, rearY, 10 + thrustVisual * 6);
    this.exhaust.fillStyle(0xffc56e, 0.85);
    this.exhaust.fillCircle(tailX, tailY, 5 + thrustVisual * 4);

    this.exhaust.fillStyle(0xfff0aa, 0.92);
    this.exhaust.fillTriangle(
      rearX + sideX,
      rearY + sideY,
      rearX - sideX,
      rearY - sideY,
      tailX,
      tailY,
    );
    this.exhaust.fillStyle(0xffb057, 0.82);
    this.exhaust.fillTriangle(
      rearX + sideX * 1.55,
      rearY + sideY * 1.55,
      rearX - sideX * 1.55,
      rearY - sideY * 1.55,
      tailX - Math.cos(state.orientation) * (16 + thrustVisual * 20),
      tailY - Math.sin(state.orientation) * (16 + thrustVisual * 20),
    );
    this.exhaust.fillStyle(0xff7d38, 0.58);
    this.exhaust.fillTriangle(
      rearX + sideX * 2.15,
      rearY + sideY * 2.15,
      rearX - sideX * 2.15,
      rearY - sideY * 2.15,
      tailX - Math.cos(state.orientation) * (34 + thrustVisual * 26),
      tailY - Math.sin(state.orientation) * (34 + thrustVisual * 26),
    );
  }

  updateHud(state) {
    const fuelPct =
      this.stats.fuel > 0 ? (state.fuelRemaining / this.stats.fuel) * 100 : 0;
    const zoomBiasPct = Math.round(
      (this.manualZoomOffset / this.zoomSettings.step) * 6,
    );
    const missionPhase = this.getMissionPhase(state);

    this.metricsText.setText(
      [
        `Phase: ${state.phase}`,
        `Engine: ${state.engineOn ? "ON" : "OFF"}`,
        `Altitude: ${state.altitude.toFixed(1)} km`,
        `Speed: ${state.speed.toFixed(2)} km/s`,
        `Radial vel: ${state.radialVelocity.toFixed(2)} km/s`,
        `Tangential vel: ${Math.abs(state.tangentialVelocity).toFixed(2)} km/s`,
        `Throttle: ${Math.round(state.throttle * 100)}%`,
        `Fuel: ${Math.max(0, fuelPct).toFixed(0)}%`,
        `G-load: ${state.currentG.toFixed(1)} g`,
        `Mission step: ${missionPhase.index}/${missionPhase.total}`,
        `View zoom: ${this.cameraRig.zoom.toFixed(2)}x`,
        `Zoom trim: ${zoomBiasPct >= 0 ? "+" : ""}${zoomBiasPct}%`,
      ].join("\n"),
    );

    this.progressText.setText(
      [
        "Primary Objective",
        "Place the ship into a stable orbit around Earth.",
        "",
        `${missionPhase.label}`,
        missionPhase.message,
        "",
        `Orbit altitude: ${FLIGHT_WORLD.targetOrbitAltitude} km`,
        `Target orbital speed: ${FLIGHT_TARGETS.orbitalVelocity.toFixed(2)} km/s`,
        `Orbit lock: ${state.orbitHoldTime.toFixed(1)} / ${FLIGHT_WORLD.orbitLockDuration}s`,
        `Apoapsis: ${state.apoapsis.toFixed(1)} km`,
        `Periapsis: ${state.periapsis.toFixed(1)} km`,
        `Pilot input: ${this.controls.source}`,
        `Checklist: ${this.buildMissionChecklist(state)}`,
        state.reason
          ? `Status: ${state.reason}`
          : state.engineOn
            ? `Status: ${missionPhase.status}`
            : "Status: ignite the engine to leave the launch pad",
      ].join("\n"),
    );
  }

  getMissionPhase(state) {
    const total = 5;

    if (state.orbitAchieved || state.result === "success" || state.orbitHoldTime > 0.5) {
      return {
        id: "hold-orbit",
        index: 5,
        total,
        label: "Phase 5: Hold Orbit",
        title: "Phase 5/5: Hold Orbit",
        message:
          "Stay close to target altitude and keep radial speed low until orbit lock completes.",
        status: "Hold a clean orbit until the lock timer completes.",
      };
    }

    if (!state.launched || state.altitude < 12) {
      return {
        id: "launch",
        index: 1,
        total,
        label: "Phase 1: Launch",
        title: "Phase 1/5: Launch",
        message:
          "Ignite the engine and lift off cleanly. Keep the stack steady while leaving the pad.",
        status: "Climb straight and avoid over-correcting.",
      };
    }

    if (state.altitude < FLIGHT_WORLD.atmosphereHeight * 0.55) {
      return {
        id: "ascent",
        index: 2,
        total,
        label: "Phase 2: Atmospheric Ascent",
        title: "Phase 2/5: Atmospheric Ascent",
        message:
          "Build altitude first. Stay mostly vertical while the atmosphere is still dense.",
        status: "Keep rising and save aggressive turning for later.",
      };
    }

    if (state.altitude < FLIGHT_WORLD.atmosphereHeight + 35) {
      return {
        id: "gravity-turn",
        index: 3,
        total,
        label: "Phase 3: Gravity Turn",
        title: "Phase 3/5: Gravity Turn",
        message:
          "Start a gentle pitch to the side so the rocket trades vertical climb for horizontal speed.",
        status: "Turn gradually and keep the rocket under control.",
      };
    }

    return {
      id: "circularize",
      index: 4,
      total,
      label: "Phase 4: Circularize",
      title: "Phase 4/5: Circularize",
      message:
        "Match the target orbital corridor by building sideways speed near the target altitude.",
      status: "Trim altitude and chase orbital velocity, not raw height.",
    };
  }

  buildMissionChecklist(state) {
    const checks = [
      `${state.launched ? "[x]" : "[ ]"} liftoff`,
      `${state.altitude >= FLIGHT_WORLD.atmosphereHeight ? "[x]" : "[ ]"} clear atmosphere`,
      `${Math.abs(state.tangentialVelocity) >= FLIGHT_TARGETS.orbitalVelocity * 0.75 ? "[x]" : "[ ]"} build lateral speed`,
      `${state.orbitHoldTime > 0.5 ? "[x]" : "[ ]"} stabilize orbit`,
    ];
    return checks.join(" ");
  }

  updateMissionPhase(state) {
    const missionPhase = this.getMissionPhase(state);
    if (missionPhase.id === this.missionPhaseId) {
      return;
    }

    this.missionPhaseId = missionPhase.id;
    this.phaseBannerTitle.setText(missionPhase.title);
    this.phaseBannerBody.setText(missionPhase.message);

    this.tweens.killTweensOf([
      this.phaseBannerShadow,
      this.phaseBanner,
      this.phaseBannerTitle,
      this.phaseBannerBody,
    ]);

    [
      this.phaseBannerShadow,
      this.phaseBanner,
      this.phaseBannerTitle,
      this.phaseBannerBody,
    ].forEach((object) => {
      object.setAlpha(0.3);
    });

    this.tweens.add({
      targets: [
        this.phaseBannerShadow,
        this.phaseBanner,
        this.phaseBannerTitle,
        this.phaseBannerBody,
      ],
      alpha: 1,
      duration: 260,
      ease: "Quad.easeOut",
    });
  }

  updatePilotControls(delta) {
    const leftPressed = this.flightKeys.left.isDown || this.flightKeys.a.isDown;
    const rightPressed =
      this.flightKeys.right.isDown || this.flightKeys.d.isDown;
    const upPressed = this.flightKeys.up.isDown || this.flightKeys.w.isDown;
    const downPressed = this.flightKeys.down.isDown || this.flightKeys.s.isDown;
    const keyboardSteer = (rightPressed ? 1 : 0) - (leftPressed ? 1 : 0);
    const steerStrength = 0.1;
    const steerResponse = Phaser.Math.Clamp(delta * 0.0045, 0, 0.1);
    const desiredSteer = keyboardSteer * steerStrength;

    if (
      Phaser.Input.Keyboard.JustDown(this.flightKeys.f) ||
      Phaser.Input.Keyboard.JustDown(this.flightKeys.space)
    ) {
      this.toggleEngine();
    }
    if (Phaser.Input.Keyboard.JustDown(this.flightKeys.q)) {
      this.adjustManualZoom(this.zoomSettings.step);
    }
    if (Phaser.Input.Keyboard.JustDown(this.flightKeys.e)) {
      this.adjustManualZoom(-this.zoomSettings.step);
    }
    if (Phaser.Input.Keyboard.JustDown(this.flightKeys.r)) {
      this.manualZoomOffset = 0;
    }

    if (upPressed) {
      this.controls.cruiseThrottle = Math.min(
        1,
        this.controls.cruiseThrottle + delta * 0.0009,
      );
    }
    if (downPressed) {
      this.controls.cruiseThrottle = Math.max(
        0.18,
        this.controls.cruiseThrottle - delta * 0.0009,
      );
    }

    this.controls.throttle = this.controls.engineOn
      ? this.flightKeys.shift.isDown
        ? 1
        : this.controls.cruiseThrottle
      : 0;

    this.controls.steer = Phaser.Math.Linear(
      this.controls.steer,
      desiredSteer,
      steerResponse,
    );
    this.controls.source =
      keyboardSteer !== 0
        ? "Keyboard"
        : this.controls.engineOn
          ? "Stabilized"
          : "Pad";
  }

  toggleEngine() {
    this.controls.engineOn = !this.controls.engineOn;
  }

  updateEngineButton(state) {
    const isOn = state?.engineOn ?? this.controls.engineOn;
    const fillColor = isOn ? 0x5b1f1f : 0x163248;
    const strokeColor = isOn ? 0xff9b7a : 0x73f7c0;
    const label = isOn ? "Shutdown Engine" : "Ignite Engine";

    this.engineButton.setFillStyle(fillColor, 0.96);
    this.engineButton.setStrokeStyle(2, strokeColor, 0.7);
    this.engineButtonLabel.setText(label);
  }

  handleWheelZoom(pointer, gameObjects, deltaX, deltaY, deltaZ, event) {
    const direction = Math.sign(-deltaY);
    if (direction !== 0) {
      this.adjustManualZoom(direction * this.zoomSettings.wheelStep);
      event?.preventDefault?.();
    }
  }

  adjustManualZoom(delta) {
    this.manualZoomOffset = Phaser.Math.Clamp(
      this.manualZoomOffset + delta,
      this.zoomSettings.min - 1.1,
      this.zoomSettings.max - 0.34,
    );
  }

  getWorldObjects() {
    return [
      this.nebula,
      ...(this.stars || []),
      this.orbitGraphics,
      this.trailGraphics,
      this.planetAtmosphere,
      this.planetBody,
      this.planetDetails,
      this.launchMarker,
      this.launchSky,
      this.launchGround,
      this.launchHorizon,
      this.launchPad,
      this.launchPadSmoke,
      this.launchPadGlow,
      this.horizonClouds,
      this.rocket,
      this.exhaustSmoke,
      this.exhaust,
    ].filter(Boolean);
  }

  fadeOutScene(duration) {
    this.worldCamera?.fadeOut(duration, 0, 0, 0);
    this.uiCamera?.fadeOut(duration, 0, 0, 0);
  }

  updateSmokeTrail(state, delta) {
    const lifeStep = delta / 1000;
    const thrustVisual =
      state.engineOn && state.fuelRemaining > 0 ? state.throttle : 0;
    const rearX = state.position.x - Math.cos(state.orientation) * 28;
    const rearY = state.position.y - Math.sin(state.orientation) * 28;
    const smokeAmount = Math.round(
      Phaser.Math.Clamp(
        thrustVisual * (0.8 + state.atmosphereDensity * 2.8),
        0,
        4,
      ),
    );

    for (let index = 0; index < smokeAmount; index += 1) {
      const spread = Phaser.Math.FloatBetween(-0.28, 0.28);
      const speed = Phaser.Math.FloatBetween(18, 40) * (0.7 + state.throttle);
      this.smokeTrail.push({
        x: rearX + Phaser.Math.Between(-4, 4),
        y: rearY + Phaser.Math.Between(-4, 4),
        vx:
          -Math.cos(state.orientation + spread) * speed * 0.05 +
          Phaser.Math.FloatBetween(-0.22, 0.22),
        vy:
          -Math.sin(state.orientation + spread) * speed * 0.05 +
          Phaser.Math.FloatBetween(-0.22, 0.22),
        size: Phaser.Math.FloatBetween(8, 13),
        growth: Phaser.Math.FloatBetween(18, 28),
        life:
          Phaser.Math.FloatBetween(0.35, 0.85) *
          (0.65 + state.atmosphereDensity),
        maxLife: 1,
        heat: Phaser.Math.FloatBetween(0.15, 0.55),
      });
    }

    this.smokeTrail = this.smokeTrail.filter((puff) => {
      puff.life -= lifeStep;
      puff.x += puff.vx;
      puff.y += puff.vy;
      puff.size += puff.growth * lifeStep;

      if (puff.life <= 0) {
        return false;
      }

      const alpha = Phaser.Math.Clamp(puff.life / puff.maxLife, 0, 1);
      const heatColor = puff.heat > 0.35 ? 0xffb17a : 0xb9c4cf;

      this.exhaustSmoke.fillStyle(heatColor, alpha * 0.14);
      this.exhaustSmoke.fillCircle(puff.x, puff.y, puff.size);
      this.exhaustSmoke.fillStyle(0x55616d, alpha * 0.22);
      this.exhaustSmoke.fillCircle(puff.x, puff.y, puff.size * 0.78);
      return true;
    });
  }
}
