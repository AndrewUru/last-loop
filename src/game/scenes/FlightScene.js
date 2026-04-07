import Phaser from "phaser";
import ShipPart from "../entities/ShipPart.js";
import ShipStatsCalculator from "../systems/ShipStatsCalculator.js";
import FlightSimulator, {
  FLIGHT_WORLD,
} from "../systems/FlightSimulator.js";
import ThreeFlightBackdrop from "../systems/ThreeFlightBackdrop.js";
import FlightHud from "../ui/FlightHud.js";
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
    this.flightTrail = [];
    this.smokeTrail = [];
    this.padSmokeTrail = [];
    this.uiObjects = [];
    this.launchCountdown = {
      active: false,
      remaining: 0,
    };
    this.liftoffAssistTime = 0;
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
    this.targetOrbitBand = this.add.graphics().setDepth(-19);
    this.trailGraphics = this.add.graphics().setDepth(11);
    this.trajectoryPrediction = this.add.graphics().setDepth(10);
    this.trajectoryMarkers = this.add.graphics().setDepth(10);
    this.planetAtmosphere = this.add.graphics().setDepth(-18);
    this.planetBody = this.add.graphics().setDepth(-17);
    this.planetDetails = this.add.graphics().setDepth(-16);
    this.launchMarker = this.add.graphics().setDepth(-15);

    this.drawPlanet();
    this.drawOrbitGuides();
    this.targetOrbitBand.setAlpha(0.04);
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
    const corridorWidth = 18;

    this.orbitGraphics.clear();
    this.targetOrbitBand.clear();
    this.targetOrbitBand.lineStyle(corridorWidth * 2, 0x73f7c0, 0.08);
    this.targetOrbitBand.strokeCircle(0, 0, targetRadius);
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
    this.hud = new FlightHud(this, {
      onEngineToggle: () => this.handleEngineToggle(),
    });
    this.hud.create();
    this.uiObjects.push(...this.hud.getObjects());
    this.layoutHud();
  }

  layoutHud(width = this.scale.width, height = this.scale.height) {
    this.hud?.layout(width, height);
  }

  update(time, delta) {
    this.updateLaunchCountdown(delta);
    this.updatePilotControls(delta);
    const state = this.simulator.update(delta, this.controls);

    this.updateTrail(state);
    this.updateOrbitalWorldVisuals(state);
    this.updateTrajectoryGuidance(state);
    this.updateCamera(state);
    this.updateLaunchComplex(state, delta);
    this.updateStars(state);
    this.updateRocketPose(state);
    this.updateExhaust(state, time, delta);
    this.hud?.update(state, {
      stats: this.stats,
      controlsSource: this.controls.source,
      cameraZoom: this.cameraRig.zoom,
      manualZoomOffset: this.manualZoomOffset,
      zoomSettings: this.zoomSettings,
      predictionSummary: this.predictionSummary,
      countdown: this.launchCountdown,
    });
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
    const bandAlpha = Phaser.Math.Linear(0.04, 0.34, orbitalOverlayProgress);
    const planetAlpha = Phaser.Math.Linear(0.01, 0.08, orbitalOverlayProgress);
    const detailsAlpha = Phaser.Math.Linear(0.01, 0.09, orbitalOverlayProgress);

    this.targetOrbitBand.setAlpha(bandAlpha);
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

  updateTrajectoryGuidance(state) {
    const prediction = this.predictOrbitPath(state);
    this.predictionSummary = prediction;
    this.trajectoryPrediction.clear();
    this.trajectoryMarkers.clear();

    if (prediction.points.length < 2) {
      return;
    }

    for (let index = 0; index < prediction.points.length; index += 1) {
      const point = prediction.points[index];
      const progress = index / prediction.points.length;
      const alpha = 0.16 + progress * 0.36;

      this.trajectoryPrediction.fillStyle(0x8fd7ff, alpha);
      this.trajectoryPrediction.fillCircle(point.x, point.y, 2 + progress * 1.5);
    }

    if (prediction.apoapsisPoint) {
      this.trajectoryMarkers.lineStyle(2, 0xffd773, 0.85);
      this.trajectoryMarkers.strokeCircle(
        prediction.apoapsisPoint.x,
        prediction.apoapsisPoint.y,
        10,
      );
      this.trajectoryMarkers.fillStyle(0xffd773, 0.22);
      this.trajectoryMarkers.fillCircle(
        prediction.apoapsisPoint.x,
        prediction.apoapsisPoint.y,
        10,
      );
    }

    if (prediction.corridorPoint) {
      this.trajectoryMarkers.lineStyle(2, 0x73f7c0, 0.95);
      this.trajectoryMarkers.strokeCircle(
        prediction.corridorPoint.x,
        prediction.corridorPoint.y,
        7,
      );
      this.trajectoryMarkers.lineStyle(2, 0x73f7c0, 0.55);
      this.trajectoryMarkers.lineBetween(
        state.position.x,
        state.position.y,
        prediction.corridorPoint.x,
        prediction.corridorPoint.y,
      );
    }
  }

  predictOrbitPath(state) {
    if (!state.launched) {
      return {
        points: [],
        apoapsis: state.altitude,
        periapsis: state.altitude,
        apoapsisPoint: null,
        corridorPoint: null,
      };
    }

    const points = [];
    const position = { ...state.position };
    const velocity = { ...state.velocity };
    const targetRadius =
      FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude;
    const thrustMagnitude = 0.13 + this.stats.twr * 0.07;
    const step = 0.08;
    const steps = 300;
    const burnSteps =
      state.engineOn && state.fuelRemaining > 0.01
        ? Math.round(steps * 0.22)
        : 0;
    const dragBase =
      0.012 + Math.max(this.stats.mass - 22, 0) * 0.00012;

    let apoapsis = state.altitude;
    let periapsis = state.altitude;
    let apoapsisPoint = { ...position };
    let corridorPoint = null;
    let bestCorridorDelta = Number.POSITIVE_INFINITY;

    for (let index = 0; index < steps; index += 1) {
      const radius = Math.hypot(position.x, position.y);
      const altitude = radius - FLIGHT_WORLD.planetRadius;
      const radialUnit = radius > 0
        ? { x: position.x / radius, y: position.y / radius }
        : { x: 0, y: -1 };
      const gravityStrength =
        FLIGHT_WORLD.gravitationalParameter / Math.max(radius * radius, 1);
      const atmosphereDensity = Phaser.Math.Clamp(
        1 - altitude / FLIGHT_WORLD.atmosphereHeight,
        0,
        1,
      );
      const dragStrength = atmosphereDensity * atmosphereDensity * dragBase;
      const thrustActive = index < burnSteps;
      const thrustAcceleration = thrustActive
        ? {
            x: Math.cos(state.orientation) * thrustMagnitude * state.throttle,
            y: Math.sin(state.orientation) * thrustMagnitude * state.throttle,
          }
        : { x: 0, y: 0 };
      const totalAcceleration = {
        x:
          -radialUnit.x * gravityStrength +
          thrustAcceleration.x -
          velocity.x * dragStrength,
        y:
          -radialUnit.y * gravityStrength +
          thrustAcceleration.y -
          velocity.y * dragStrength,
      };

      velocity.x += totalAcceleration.x * step;
      velocity.y += totalAcceleration.y * step;
      position.x += velocity.x * step * 60;
      position.y += velocity.y * step * 60;

      const updatedRadius = Math.hypot(position.x, position.y);
      const updatedAltitude = updatedRadius - FLIGHT_WORLD.planetRadius;

      if (index % 3 === 0) {
        points.push({ x: position.x, y: position.y });
      }

      if (updatedAltitude > apoapsis) {
        apoapsis = updatedAltitude;
        apoapsisPoint = { ...position };
      }
      periapsis = Math.min(periapsis, updatedAltitude);

      const corridorDelta = Math.abs(updatedRadius - targetRadius);
      if (corridorDelta < bestCorridorDelta) {
        bestCorridorDelta = corridorDelta;
        corridorPoint = { ...position };
      }

      if (updatedAltitude < -6) {
        break;
      }
    }

    return {
      points,
      apoapsis,
      periapsis,
      apoapsisPoint,
      corridorPoint,
    };
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
    this.hud?.update(state, {
      stats: this.stats,
      controlsSource: this.controls.source,
      cameraZoom: this.cameraRig.zoom,
      manualZoomOffset: this.manualZoomOffset,
      zoomSettings: this.zoomSettings,
      predictionSummary: this.predictionSummary,
      countdown: this.launchCountdown,
    });
  }

  getMissionPhase(state) {
    return this.hud?.getMissionPhase?.(state);
  }

  buildMissionChecklist(state) {
    return this.hud?.buildMissionChecklist?.(state);
  }

  updateMissionPhase(state) {
    const missionPhase = this.hud?.getMissionPhase?.(state);
    if (!missionPhase) {
      return;
    }
    this.hud?.updateMissionPhase?.(
      state,
      { countdown: this.launchCountdown },
      missionPhase,
    );
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
      this.handleEngineToggle();
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

    if (this.launchCountdown.active) {
      this.controls.throttle = 0;
      this.controls.steer = Phaser.Math.Linear(this.controls.steer, 0, 0.12);
      this.controls.source = "Countdown";
      return;
    }

    const liftoffAssistActive = this.liftoffAssistTime > 0;
    this.controls.throttle = this.controls.engineOn
      ? liftoffAssistActive
        ? Math.max(this.controls.cruiseThrottle, 0.96)
        : this.flightKeys.shift.isDown
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
        : liftoffAssistActive
          ? "Launch Assist"
          : this.controls.engineOn
            ? "Stabilized"
            : "Pad";
  }

  updateLaunchCountdown(delta) {
    if (this.liftoffAssistTime > 0) {
      this.liftoffAssistTime = Math.max(0, this.liftoffAssistTime - delta / 1000);
    }

    if (!this.launchCountdown.active) {
      return;
    }

    this.launchCountdown.remaining -= delta / 1000;
    if (this.launchCountdown.remaining <= 0) {
      this.completeLaunchCountdown();
    }
  }

  handleEngineToggle() {
    if (this.launchCountdown.active) {
      this.cancelLaunchCountdown();
      return;
    }

    if (!this.controls.engineOn && !this.simulator.state.launched) {
      this.startLaunchCountdown();
      return;
    }

    this.controls.engineOn = !this.controls.engineOn;
    if (!this.controls.engineOn) {
      this.liftoffAssistTime = 0;
    }
  }

  startLaunchCountdown() {
    this.controls.engineOn = false;
    this.controls.throttle = 0;
    this.launchCountdown.active = true;
    this.launchCountdown.remaining = 3.2;
  }

  cancelLaunchCountdown() {
    this.launchCountdown.active = false;
    this.launchCountdown.remaining = 0;
  }

  completeLaunchCountdown() {
    this.launchCountdown.active = false;
    this.launchCountdown.remaining = 0;
    this.controls.engineOn = true;
    this.controls.cruiseThrottle = Math.max(this.controls.cruiseThrottle, 0.92);
    this.liftoffAssistTime = 10;
  }

  toggleEngine() {
    this.handleEngineToggle();
  }

  updateEngineButton(state) {
    this.hud?.updateEngineButton?.(state, this.launchCountdown);
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
      this.targetOrbitBand,
      this.trailGraphics,
      this.trajectoryPrediction,
      this.trajectoryMarkers,
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
