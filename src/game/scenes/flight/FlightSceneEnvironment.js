import Phaser from "phaser";
import { ART } from "../../data/art.js";
import { FLIGHT_WORLD } from "../../systems/FlightSimulator.js";
import { FLAT_GROUND_SCALE, STAR_COUNT } from "./FlightSceneConstants.js";
import { getPresentationAltitude } from "./FlightSceneUtils.js";

const STAR_TINTS = [0xffffff, 0xdbeaff, 0xfff4e0, 0xcfe0ff];
// While the ground is nearly flat only the stretch around the pad can be on
// screen, so the arc is cut to this half-width.
const GROUND_HALF_WIDTH = 4000;
const GROUND_SEGMENTS = 160;

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
    // The painted Earth takes over from the drawn planet once it is round.
    const earthSize = FLIGHT_WORLD.planetRadius * 2 * ART.earth.haloScale;
    this.earthImage = this.add.image(0, 0, ART.earth.key).setDisplaySize(earthSize, earthSize).setDepth(-17.5).setAlpha(0);
    this.planetAtmosphere = this.add.graphics().setDepth(-17);
    this.orbitGuides = this.add.graphics().setDepth(-14);
    this.trailGraphics = this.add.graphics().setDepth(8);
    this.trajectoryGraphics = this.add.graphics().setDepth(9);
    this.pad = this.add.graphics().setDepth(11);
    this.guidanceArrow = this.add.graphics().setDepth(24);
    this.cloudLayers = [];

    this.groundCurve = -1;
    this.setGroundCurve(0);
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

  // reveal: 0 draws a flat horizon at the pad, 1 the real planet. Blending the
  // curvature rather than the radius makes the ground bend evenly.
  setGroundCurve(reveal) {
    if (reveal === this.groundCurve || (reveal < 1 && Math.abs(reveal - this.groundCurve) < 0.002)) {
      return;
    }
    this.groundCurve = reveal;
    const planetRadius = FLIGHT_WORLD.planetRadius;
    const radius =
      1 / Phaser.Math.Linear(1 / (planetRadius * FLAT_GROUND_SCALE), 1 / planetRadius, reveal);
    // The circle always touches the pad, so its centre drops as it flattens.
    this.groundShape = { centerY: radius - planetRadius, radius };
    this.drawPlanetBody(reveal);
  },

  // Filled shapes only: translucent strokes leave seams where segments overlap.
  drawPlanetBody(reveal) {
    const { centerY, radius } = this.groundShape;
    const span = Math.min(Math.PI, GROUND_HALF_WIDTH / radius);
    const arc = (offset, from, to) =>
      Array.from({ length: GROUND_SEGMENTS + 1 }, (_, index) => {
        const angle = from + ((to - from) * index) / GROUND_SEGMENTS;
        return { x: Math.sin(angle) * (radius + offset), y: centerY - Math.cos(angle) * (radius + offset) };
      });
    const disc = (graphics, offset) => graphics.fillPoints(arc(offset, -span, span), true);
    // A band along the surface, in two halves so each one is a simple shape.
    const band = (graphics, inner, outer) => {
      [
        [-span, 0],
        [0, span],
      ].forEach(([from, to]) => graphics.fillPoints([...arc(outer, from, to), ...arc(inner, to, from)], true));
    };

    this.planetAtmosphere.clear();
    this.planetAtmosphere.fillStyle(0x52d9ff, 0.12);
    disc(this.planetAtmosphere, 26);
    this.planetAtmosphere.fillStyle(0x7ee6ff, 0.22);
    band(this.planetAtmosphere, 1, 15);

    this.planetBody.clear();
    this.planetBody.fillStyle(0x1f5f8e, 1);
    disc(this.planetBody, 0);
    // Shading that makes it read as a globe; it only matters once it is round.
    if (reveal > 0) {
      const planetRadius = FLIGHT_WORLD.planetRadius;
      this.planetBody.fillStyle(0x2b7bb1, 0.22 * reveal);
      this.planetBody.fillCircle(0, -planetRadius * 0.12, planetRadius * 0.78);
      this.planetBody.fillStyle(0x153d5b, 0.28 * reveal);
      this.planetBody.fillCircle(planetRadius * 0.12, planetRadius * 0.22, planetRadius * 0.82);
    }
    this.planetBody.fillStyle(0xb9f2ff, 0.12);
    band(this.planetBody, -6, 0);
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

  // The tower stands left of the rocket with its access arms reaching it.
  drawLaunchPad() {
    const surface = -FLIGHT_WORLD.planetRadius;
    this.launchTower = this.add
      .image(-this.rocketWidth / 2 - 0.5, surface, ART.launchTower.key)
      .setOrigin(1, 1)
      .setDepth(11);
    this.launchTower.setScale((this.rocketHeight * 1.05) / this.launchTower.height);
    const towerLeft = this.launchTower.x - this.launchTower.displayWidth;

    this.pad.clear();
    this.pad.fillStyle(0x3a4654, 1);
    this.pad.fillRect(towerLeft - 4, surface - 1.5, this.rocketWidth / 2 + 8 - towerLeft + 4, 3);
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
    return [this.daySky, this.spaceShade, ...this.stars, ...this.getSpeedBackdropObjects()];
  },

  getWorldObjects() {
    return [
      this.planetBody,
      this.earthImage,
      this.planetAtmosphere,
      this.orbitGuides,
      this.trailGraphics,
      this.trajectoryGraphics,
      this.pad,
      this.launchTower,
      this.guidanceArrow,
      ...this.cloudLayers.map((layer) => layer.graphics),
      this.rocket,
      ...this.getExhaustObjects(),
      ...this.getSpeedWorldObjects(),
      ...this.getMissionWorldObjects(),
    ];
  },

  getUiObjects() {
    return [
      ...this.hud.getObjects(),
      ...this.touchControlsUi.getObjects(),
      ...this.getMissionUiObjects(),
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
    this.layoutMissionTracker();
    if (this.resultOverlayVisible) {
      this.layoutMissionOverlay(width, height);
    }
  },
};
