import Phaser from "phaser";
import { FLIGHT_WORLD } from "../../systems/FlightSimulator.js";
import {
  STAR_COUNT,
  VISUAL_TARGET_ORBIT_OFFSET,
} from "./FlightSceneConstants.js";

export const flightSceneEnvironmentMethods = {
  createBackdrop() {
    const { width, height } = this.scale;
    const mobile = width < 760 || (width < 920 && height > width * 1.15);
    const starCount = mobile ? Math.ceil(STAR_COUNT * 0.55) : STAR_COUNT;

    this.cameras.main.setBackgroundColor("#79c4ff");

    this.daySky = this.add.graphics().setScrollFactor(0).setDepth(-40);
    this.daySky.fillGradientStyle(0x4cb7ff, 0x69c6ff, 0xb9ecff, 0x7fd4ff, 1);
    this.daySky.fillRect(0, 0, width, height);

    this.spaceShade = this.add.graphics().setScrollFactor(0).setDepth(-34);
    this.spaceShade.fillStyle(0x04111d, 1);
    this.spaceShade.fillRect(0, 0, width, height);
    this.spaceShade.setAlpha(0);

    this.stars = Array.from({ length: starCount }, () =>
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
    this.mapCelestialGraphics = this.add.graphics().setDepth(-13.5);
    this.horizonGlow = this.add.graphics().setDepth(-13);
    this.highAltitudeHorizon = this.add.graphics().setDepth(-12);
    this.atmosphereShell = this.add.graphics().setDepth(-11);
    this.launchBackdrop = this.add.graphics().setDepth(-10);
    this.launchGround = this.add.graphics().setDepth(-9);
    this.launchTowerGlow = this.add.graphics().setDepth(9);
    this.trailGraphics = this.add.graphics().setDepth(8);
    this.trajectoryGraphics = this.add.graphics().setDepth(9);
    this.markerGraphics = this.add.graphics().setDepth(10);
    this.apoapsisLabel = this.createOrbitMarkerLabel(0xffd773);
    this.periapsisLabel = this.createOrbitMarkerLabel(0xff8d8d);
    this.corridorLabel = this.createOrbitMarkerLabel(0x73f7c0);
    this.padGlow = this.add.graphics().setDepth(10);
    this.pad = this.add.container(0, 0).setDepth(11);
    this.launchTower = this.add.container(0, 0).setDepth(12);
    this.launchSpeedLines = this.add.graphics().setDepth(17);
    this.cloudLayers = [];
    this.contrailGraphics = this.add.graphics().setDepth(7);
    this.heatingGlow = this.add.graphics().setDepth(21);

    this.drawPlanetBody();
    this.drawOrbitGuides();
    this.drawMapCelestials();
    this.drawLaunchBackdrop();
    this.drawLaunchGround();
    this.buildLaunchPad();
    this.createCloudLayers();
  },

  createCloudLayers() {
    const cloudAltitudes = [800, 2000, 4500, 8000, 12000];
    const mobile =
      this.scale.width < 760 ||
      (this.scale.width < 920 && this.scale.height > this.scale.width * 1.15);
    const cloudCount = mobile ? 18 : 40;
    cloudAltitudes.forEach((alt) => {
      const cloud = this.add.graphics().setDepth(-8);
      cloud.fillStyle(0xffffff, 0.25);
      for (let i = 0; i < cloudCount; i++) {
        const x = Phaser.Math.Between(-2000, 2000);
        const y = -FLIGHT_WORLD.planetRadius + alt + Phaser.Math.Between(-20, 20);
        const w = 30 + Math.random() * 80;
        const h = 8 + Math.random() * 16;
        cloud.fillEllipse(x, y, w, h);
      }
      cloud.setAlpha(0);
      this.cloudLayers.push({ graphics: cloud, altitude: alt });
    });
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

  drawMapCelestials() {
    const moonOrbitRadius = 940;
    const moonAngle = -0.82;
    const moonX = Math.cos(moonAngle) * moonOrbitRadius;
    const moonY = Math.sin(moonAngle) * moonOrbitRadius;
    const sunX = 1780;
    const sunY = -620;

    this.mapCelestialGraphics.clear();
    this.mapCelestialGraphics.lineStyle(1.5, 0x9fb8d2, 0.24);
    this.mapCelestialGraphics.strokeCircle(0, 0, moonOrbitRadius);
    this.mapCelestialGraphics.fillStyle(0xc8d0d8, 1);
    this.mapCelestialGraphics.fillCircle(moonX, moonY, 34);
    this.mapCelestialGraphics.fillStyle(0x8f9ba6, 0.32);
    this.mapCelestialGraphics.fillCircle(moonX - 8, moonY + 7, 18);

    this.mapCelestialGraphics.lineStyle(1, 0xffd773, 0.14);
    this.mapCelestialGraphics.beginPath();
    this.mapCelestialGraphics.moveTo(0, 0);
    this.mapCelestialGraphics.lineTo(sunX, sunY);
    this.mapCelestialGraphics.strokePath();
    this.mapCelestialGraphics.fillStyle(0xffd773, 0.92);
    this.mapCelestialGraphics.fillCircle(sunX, sunY, 54);
    this.mapCelestialGraphics.fillStyle(0xfff2bf, 0.18);
    this.mapCelestialGraphics.fillCircle(sunX, sunY, 112);
    this.mapCelestialGraphics.setAlpha(0);
  },

  createOrbitMarkerLabel(accent) {
    return this.add
      .text(0, 0, "", {
        fontSize: "12px",
        color: "#f7fbff",
        fontStyle: "bold",
        backgroundColor: "rgba(8, 14, 20, 0.72)",
        padding: { left: 7, right: 7, top: 4, bottom: 4 },
      })
      .setOrigin(0, 0.5)
      .setStroke("#081019", 3)
      .setShadow(0, 1, "#000000", 3, true, true)
      .setTint(accent)
      .setDepth(11)
      .setVisible(false);
  },

  buildLaunchPad() {
    this.pad.removeAll(true);
    this.launchTower.removeAll(true);
  },

  drawLaunchBackdrop() {
    this.launchBackdrop.clear();
  },

  drawLaunchGround() {
    this.launchGround.clear();
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
      this.mapCelestialGraphics,
      this.horizonGlow,
      this.highAltitudeHorizon,
      this.atmosphereShell,
      this.launchBackdrop,
      this.launchGround,
      this.launchTowerGlow,
      this.trailGraphics,
      this.trajectoryGraphics,
      this.markerGraphics,
      this.apoapsisLabel,
      this.periapsisLabel,
      this.corridorLabel,
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
    return [
      ...this.hud.getObjects(),
      ...this.touchControlsUi.getObjects(),
      this.resultOverlay,
    ];
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
    this.touchControlsUi.resize(width, height);
    this.layoutMissionOverlay(width, height);
  },
};
