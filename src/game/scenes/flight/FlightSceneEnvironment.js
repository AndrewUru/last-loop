import Phaser from "phaser";
import { FLIGHT_WORLD } from "../../systems/FlightSimulator.js";
import { STAR_COUNT } from "./FlightSceneConstants.js";
import { getPresentationAltitude } from "./FlightSceneUtils.js";

const STAR_TINTS = [0xffffff, 0xdbeaff, 0xfff4e0, 0xcfe0ff];

function renderRadius(altitude) {
  return FLIGHT_WORLD.planetRadius + getPresentationAltitude(altitude);
}

export const flightSceneEnvironmentMethods = {
  createBackdrop() {
    const { width, height } = this.scale;
    const mobile = width < 760 || (width < 920 && height > width * 1.15);
    const starCount = mobile ? Math.ceil(STAR_COUNT * 0.55) : STAR_COUNT;

    this.cameras.main.setBackgroundColor("#79c4ff");

    this.daySky = this.add.graphics().setScrollFactor(0).setDepth(-40);
    this.spaceShade = this.add.graphics().setScrollFactor(0).setDepth(-34).setAlpha(0);
    this.stars = Array.from({ length: starCount }, () =>
      this.add
        .circle(0, 0, Phaser.Math.FloatBetween(0.8, 2), Phaser.Utils.Array.GetRandom(STAR_TINTS), 1)
        .setScrollFactor(0)
        .setAlpha(0),
    );
  },

  createWorld() {
    this.planetBody = this.add.graphics().setDepth(-18);
    this.planetAtmosphere = this.add.graphics().setDepth(-17);
    this.orbitGuides = this.add.graphics().setDepth(-14);
    this.trailGraphics = this.add.graphics().setDepth(8);
    this.trajectoryGraphics = this.add.graphics().setDepth(9);
    this.pad = this.add.graphics().setDepth(11);
    this.guidanceArrow = this.add.graphics().setDepth(24);
    this.cloudLayers = [];

    this.drawPlanetBody();
    this.drawOrbitGuides();
    this.createCloudLayers();
  },

  createCloudLayers() {
    const mobile =
      this.scale.width < 760 ||
      (this.scale.width < 920 && this.scale.height > this.scale.width * 1.15);
    const cloudCount = mobile ? 18 : 40;
    [2, 4, 7, 11].forEach((altitude) => {
      const cloud = this.add.graphics().setDepth(-8).setAlpha(0);
      cloud.fillStyle(0xffffff, 0.25);
      for (let i = 0; i < cloudCount; i += 1) {
        cloud.fillEllipse(
          Phaser.Math.Between(-400, 400),
          -renderRadius(altitude) + Phaser.Math.Between(-6, 6),
          12 + Math.random() * 30,
          3 + Math.random() * 5,
          12,
        );
      }
      this.cloudLayers.push({ graphics: cloud, altitude });
    });
  },

  drawPlanetBody() {
    const radius = FLIGHT_WORLD.planetRadius;

    this.planetAtmosphere.clear();
    this.planetAtmosphere.fillStyle(0x52d9ff, 0.12);
    this.planetAtmosphere.fillCircle(0, 0, radius + 26);
    this.planetAtmosphere.lineStyle(14, 0x7ee6ff, 0.22);
    this.planetAtmosphere.strokeCircle(0, 0, radius + 8);

    this.planetBody.clear();
    this.planetBody.fillStyle(0x1f5f8e, 1);
    this.planetBody.fillCircle(0, 0, radius);
    this.planetBody.fillStyle(0x2b7bb1, 0.22);
    this.planetBody.fillCircle(0, -radius * 0.12, radius * 0.78);
    this.planetBody.fillStyle(0x153d5b, 0.28);
    this.planetBody.fillCircle(radius * 0.12, radius * 0.22, radius * 0.82);
    this.planetBody.lineStyle(6, 0xb9f2ff, 0.12);
    this.planetBody.strokeCircle(0, 0, radius - 3);
  },

  // The green ring is the orbit line the HUD talks about; the faint one is
  // the top of the atmosphere.
  drawOrbitGuides() {
    this.orbitGuides.clear();
    this.orbitGuides.lineStyle(1.5, 0x9fe4ff, 0.35);
    this.orbitGuides.strokeCircle(0, 0, renderRadius(FLIGHT_WORLD.atmosphereHeight));
    this.orbitGuides.lineStyle(3, 0x73f7c0, 0.75);
    this.orbitGuides.strokeCircle(0, 0, renderRadius(FLIGHT_WORLD.orbitMinAltitude));
  },

  drawLaunchPad() {
    const surface = -FLIGHT_WORLD.planetRadius;
    const towerX = this.rocketWidth / 2 + 3;
    const towerHeight = this.rocketHeight * 0.85;

    this.pad.clear();
    this.pad.fillStyle(0x3a4654, 1);
    this.pad.fillRect(-this.rocketWidth / 2 - 8, surface - 1.5, this.rocketWidth + 16, 3);
    this.pad.fillStyle(0x56677a, 1);
    this.pad.fillRect(towerX, surface - towerHeight, 2.5, towerHeight);
    this.pad.lineStyle(0.6, 0x8fa5b8, 0.9);
    for (let y = surface; y > surface - towerHeight + 3; y -= 4) {
      this.pad.lineBetween(towerX, y, towerX + 2.5, y - 4);
    }
    this.pad.fillStyle(0xc0392b, 1);
    this.pad.fillRect(towerX - 0.5, surface - towerHeight - 1.5, 3.5, 1.5);
  },

  createUiCamera() {
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.setName("ui");
    this.uiCamera.ignore([...this.getBackdropObjects(), ...this.getWorldObjects()]);
    this.cameras.main.ignore(this.getUiObjects());
  },

  createBackdropCamera() {
    this.backdropCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.backdropCamera.setName("backdrop");
    this.backdropCamera.ignore([...this.getWorldObjects(), ...this.getUiObjects()]);
    this.cameras.main.ignore(this.getBackdropObjects());
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");

    // The sky has to be drawn before the world camera.
    const cameraList = this.cameras.cameras;
    cameraList.splice(cameraList.indexOf(this.backdropCamera), 1);
    cameraList.unshift(this.backdropCamera);
  },

  getBackdropObjects() {
    return [this.daySky, this.spaceShade, ...this.stars];
  },

  getWorldObjects() {
    return [
      this.planetBody,
      this.planetAtmosphere,
      this.orbitGuides,
      this.trailGraphics,
      this.trajectoryGraphics,
      this.pad,
      this.guidanceArrow,
      ...this.cloudLayers.map((layer) => layer.graphics),
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
    const { width, height } = gameSize;

    this.daySky.clear();
    this.daySky.fillGradientStyle(0x4cb7ff, 0x69c6ff, 0xb9ecff, 0x7fd4ff, 1);
    this.daySky.fillRect(0, 0, width, height);

    this.spaceShade.clear();
    this.spaceShade.fillStyle(0x04111d, 1);
    this.spaceShade.fillRect(0, 0, width, height);

    this.stars.forEach((star) => {
      star.setPosition(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height));
    });

    this.backdropCamera.setSize(width, height);
    this.uiCamera.setSize(width, height);
    this.cameras.main.setSize(width, height);
    this.touchControlsUi.resize(width, height);
    this.hud.resize(width, height);
    if (this.resultOverlayVisible) {
      this.layoutMissionOverlay(width, height);
    }
  },
};
