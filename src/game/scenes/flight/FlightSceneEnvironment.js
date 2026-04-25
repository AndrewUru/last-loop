import Phaser from "phaser";
import { FLIGHT_WORLD } from "../../systems/FlightSimulator.js";
import {
  LAUNCH_PAD_COLORS,
  STAR_COUNT,
  VISUAL_TARGET_ORBIT_OFFSET,
} from "./FlightSceneConstants.js";

export const flightSceneEnvironmentMethods = {
  createBackdrop() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#79c4ff");

    this.daySky = this.add.graphics().setScrollFactor(0).setDepth(-40);
    this.daySky.fillGradientStyle(0x4cb7ff, 0x69c6ff, 0xb9ecff, 0x7fd4ff, 1);
    this.daySky.fillRect(0, 0, width, height);

    this.spaceShade = this.add.graphics().setScrollFactor(0).setDepth(-34);
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
  },

  createWorld() {
    this.planetBody = this.add.graphics().setDepth(-18);
    this.planetAtmosphere = this.add.graphics().setDepth(-17);
    this.planetLight = this.add.graphics().setDepth(-16);
    this.orbitBand = this.add.graphics().setDepth(-15);
    this.orbitGuides = this.add.graphics().setDepth(-14);
    this.horizonGlow = this.add.graphics().setDepth(-13);
    this.highAltitudeHorizon = this.add.graphics().setDepth(-12);
    this.atmosphereShell = this.add.graphics().setDepth(-11);
    this.launchBackdrop = this.add.graphics().setDepth(-10);
    this.launchGround = this.add.graphics().setDepth(-9);
    this.launchTowerGlow = this.add.graphics().setDepth(9);
    this.trailGraphics = this.add.graphics().setDepth(8);
    this.trajectoryGraphics = this.add.graphics().setDepth(9);
    this.markerGraphics = this.add.graphics().setDepth(10);
    this.padGlow = this.add.graphics().setDepth(10);
    this.pad = this.add.container(0, 0).setDepth(11);
    this.launchTower = this.add.container(0, 0).setDepth(12);
    this.launchSpeedLines = this.add.graphics().setDepth(17);

    this.drawPlanetBody();
    this.drawOrbitGuides();
    this.drawLaunchBackdrop();
    this.drawLaunchGround();
    this.buildLaunchPad();
  },

  drawPlanetBody() {
    const radius = FLIGHT_WORLD.planetRadius;
    const atmosphereRadius = radius + 26;

    this.planetBody.clear();
    this.planetAtmosphere.clear();
    this.planetLight.clear();

    this.planetAtmosphere.fillStyle(0x52d9ff, 0.12);
    this.planetAtmosphere.fillCircle(0, 0, atmosphereRadius);
    this.planetAtmosphere.lineStyle(14, 0x7ee6ff, 0.22);
    this.planetAtmosphere.strokeCircle(0, 0, radius + 8);

    this.planetBody.fillStyle(0x1f5f8e, 1);
    this.planetBody.fillCircle(0, 0, radius);
    this.planetBody.fillStyle(0x2b7bb1, 0.22);
    this.planetBody.fillCircle(0, -radius * 0.12, radius * 0.78);
    this.planetBody.fillStyle(0x153d5b, 0.28);
    this.planetBody.fillCircle(radius * 0.12, radius * 0.22, radius * 0.82);
    this.planetBody.lineStyle(6, 0xb9f2ff, 0.12);
    this.planetBody.strokeCircle(0, 0, radius - 3);

    this.planetLight.clear();
  },

  drawOrbitGuides() {
    const radius = FLIGHT_WORLD.planetRadius;
    const atmosphereRadius = radius + FLIGHT_WORLD.atmosphereHeight;
    const targetRadius = radius + FLIGHT_WORLD.targetOrbitAltitude;
    const visualTargetRadius = targetRadius + VISUAL_TARGET_ORBIT_OFFSET;

    this.horizonGlow.clear();
    this.highAltitudeHorizon.clear();
    this.atmosphereShell.clear();

    this.orbitBand.clear();
    this.orbitBand.lineStyle(24, 0x73f7c0, 0.06);
    this.orbitBand.strokeCircle(0, 0, visualTargetRadius);

    this.orbitGuides.clear();
    this.orbitGuides.lineStyle(1, 0x68d9ff, 0.16);
    this.orbitGuides.strokeCircle(0, 0, atmosphereRadius);
    this.orbitGuides.lineStyle(2, 0x73f7c0, 0.22);
    this.orbitGuides.strokeCircle(0, 0, visualTargetRadius);
  },

  buildLaunchPad() {
    const padY = -FLIGHT_WORLD.planetRadius;

    this.pad.add([
      this.add.rectangle(0, padY + 54, 140, 14, LAUNCH_PAD_COLORS.baseDark, 0.95),
      this.add.rectangle(0, padY + 42, 200, 16, LAUNCH_PAD_COLORS.baseMed, 0.94),
      this.add.rectangle(0, padY + 31, 260, 6, LAUNCH_PAD_COLORS.baseLight, 0.85),
      this.add.rectangle(0, padY + 37, 60, 6, LAUNCH_PAD_COLORS.baseDark, 0.8),
      this.add.rectangle(0, padY + 22, 34, 12, LAUNCH_PAD_COLORS.highlight, 0.5),
    ]);

    this.launchTower.add([
      this.add.rectangle(-66, padY - 20, 28, 150, LAUNCH_PAD_COLORS.baseMed, 0.98),
      this.add.rectangle(-58, padY - 20, 4, 140, LAUNCH_PAD_COLORS.baseDark, 0.6),
      this.add.rectangle(-66, padY + 40, 28, 10, LAUNCH_PAD_COLORS.accent, 0.9),
      this.add.rectangle(-66, padY - 110, 4, 40, LAUNCH_PAD_COLORS.baseLight, 0.7),
      this.add.rectangle(-40, padY - 60, 60, 12, LAUNCH_PAD_COLORS.baseMed, 0.85),
      this.add.rectangle(-34, padY - 15, 70, 10, LAUNCH_PAD_COLORS.baseLight, 0.8),
      this.add.rectangle(-12, padY - 60, 8, 26, LAUNCH_PAD_COLORS.baseDark, 0.9),
      this.add.rectangle(-2, padY - 15, 10, 22, LAUNCH_PAD_COLORS.baseDark, 0.9),
      this.add.circle(-66, padY - 132, 4, LAUNCH_PAD_COLORS.lightWarn, 1),
      this.add.circle(-66, padY - 80, 5, LAUNCH_PAD_COLORS.lightBlink, 0.9),
      this.add.circle(-66, padY - 30, 4, LAUNCH_PAD_COLORS.lightBlink, 0.8),
      this.add.circle(-12, padY - 75, 3, LAUNCH_PAD_COLORS.lightWarn, 0.9),
    ]);
  },

  drawLaunchBackdrop() {
    this.launchBackdrop.clear();
  },

  drawLaunchGround() {
    this.launchGround.clear();
    const padY = -FLIGHT_WORLD.planetRadius;
    const topY = padY + 6;
    const midY = padY + 44;
    const bottomY = padY + 102;
    const halfWidth = 760;
    const innerHalfWidth = 560;

    this.launchGround.fillStyle(0x5b7287, 0.96);
    this.launchGround.fillRect(-halfWidth, topY, halfWidth * 2, bottomY - topY);

    this.launchGround.fillStyle(0x4a5f72, 0.82);
    this.launchGround.beginPath();
    this.launchGround.moveTo(-halfWidth, bottomY);
    this.launchGround.lineTo(-innerHalfWidth, midY);
    this.launchGround.lineTo(innerHalfWidth, midY);
    this.launchGround.lineTo(halfWidth, bottomY);
    this.launchGround.closePath();
    this.launchGround.fillPath();

    this.launchGround.lineStyle(4, 0xc8d9e5, 0.28);
    this.launchGround.beginPath();
    this.launchGround.moveTo(-halfWidth, topY + 2);
    this.launchGround.lineTo(halfWidth, topY + 2);
    this.launchGround.strokePath();

    this.launchGround.fillStyle(0x91a7ba, 0.2);
    this.launchGround.fillRect(-halfWidth, topY + 10, halfWidth * 2, 18);
    this.launchGround.fillStyle(0x263341, 0.18);
    this.launchGround.fillRect(-halfWidth, midY + 10, halfWidth * 2, 30);
    this.launchGround.fillStyle(0x70859a, 0.68);
    this.launchGround.fillEllipse(0, padY + 52, 250, 20);
    this.launchGround.fillStyle(0xd9ecf7, 0.16);
    this.launchGround.fillEllipse(0, padY + 46, 210, 6);
  },

  createUiCamera() {
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.setName("ui");
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);
    this.uiCamera.ignore([
      ...this.getBackdropObjects(),
      ...this.getWorldObjects(),
    ]);
    this.cameras.main.ignore(this.getUiObjects());
  },

  createBackdropCamera() {
    this.backdropCamera = this.cameras.add(
      0,
      0,
      this.scale.width,
      this.scale.height,
    );
    this.backdropCamera.setName("backdrop");
    this.backdropCamera.setScroll(0, 0);
    this.backdropCamera.setZoom(1);
    this.backdropCamera.ignore([
      ...this.getWorldObjects(),
      ...this.getUiObjects(),
    ]);
    this.cameras.main.ignore(this.getBackdropObjects());
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");

    const cameraList = this.cameras.cameras;
    const backdropIndex = cameraList.indexOf(this.backdropCamera);
    if (backdropIndex > -1) {
      cameraList.splice(backdropIndex, 1);
      cameraList.unshift(this.backdropCamera);
    }
  },

  getBackdropObjects() {
    return [
      this.daySky,
      this.spaceShade,
      ...this.stars,
    ];
  },

  getWorldObjects() {
    return [
      this.planetBody,
      this.planetAtmosphere,
      this.planetLight,
      this.orbitBand,
      this.orbitGuides,
      this.horizonGlow,
      this.highAltitudeHorizon,
      this.atmosphereShell,
      this.launchBackdrop,
      this.launchGround,
      this.launchTowerGlow,
      this.trailGraphics,
      this.trajectoryGraphics,
      this.markerGraphics,
      this.padGlow,
      this.pad,
      this.launchTower,
      this.launchSpeedLines,
      this.rocket,
      this.exhaust,
      this.exhaustFire,
      this.exhaustSmoke,
    ];
  },

  getUiObjects() {
    return [...this.hud.getObjects(), this.resultOverlay];
  },

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    this.daySky.clear();
    this.daySky.fillGradientStyle(0x4cb7ff, 0x69c6ff, 0xb9ecff, 0x7fd4ff, 1);
    this.daySky.fillRect(0, 0, width, height);

    this.spaceShade.clear();
    this.spaceShade.fillStyle(0x04111d, 1);
    this.spaceShade.fillRect(0, 0, width, height);

    this.stars.forEach((star) => {
      star.setPosition(
        Phaser.Math.Between(-width, width * 2),
        Phaser.Math.Between(-height, height * 2),
      );
    });

    this.backdropCamera.setSize(width, height);
    this.backdropCamera.setViewport(0, 0, width, height);
    this.uiCamera.setSize(width, height);
    this.uiCamera.setViewport(0, 0, width, height);
    this.hud.resize(width, height);
    this.layoutMissionOverlay(width, height);
  },
};
