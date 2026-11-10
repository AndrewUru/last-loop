import Phaser from "phaser";
import { getRocketTextureKey } from "../../data/rockets.js";
import { shockwave, sparkles } from "../../fx/Fx.js";
import { ROCKET_CELL_SIZE } from "./FlightSceneConstants.js";

// The rocket on screen, built from pieces of its artwork: one group of
// cropped images per stage plus the payload on top. Dropping a stage turns
// its pieces into debris that falls away behind the rocket, and the engines
// move up to the next stage.

const DEBRIS_LIFE = 4.5;

function maxBottom(rects) {
  return rects.reduce((bottom, rect) => Math.max(bottom, rect[3]), 0);
}

export const flightSceneStagingMethods = {
  createRocket() {
    const key = getRocketTextureKey(this.rocketDef);
    const frame = this.textures.getFrame(key);
    this.rocketHeight = this.rocketDef.height * ROCKET_CELL_SIZE;
    const scale = this.rocketHeight / frame.height;
    this.rocketWidth = frame.width * scale;

    // Every piece is the whole image at the same place, cropped to its part,
    // so together they draw the rocket exactly as one image would.
    const piece = ([left, top, right, bottom]) => {
      const image = this.add.image(0, 0, key).setOrigin(0.5, 1).setScale(scale);
      image.setCrop(left * frame.width, top * frame.height, (right - left) * frame.width, (bottom - top) * frame.height);
      image.cropShare = [left, top, right, bottom];
      return image;
    };
    const stages = this.rocketDef.stages || [];
    const payloadArt = stages.length ? this.rocketDef.payloadArt || [[0, 0, 1, 1]] : [[0, 0, 1, 1]];
    this.payloadPieces = payloadArt.map(piece);
    this.stagePieces = stages.map((stage) => (stage.art || []).map(piece));
    const payloadBottom = maxBottom(payloadArt);
    // Height of each stage's engines above the bottom of the image.
    this.stageEngineLift = stages.map((stage) => (1 - (stage.art?.length ? maxBottom(stage.art) : payloadBottom)) * this.rocketHeight);

    this.rocket = this.add.container(0, 0, [...this.stagePieces.flat(), ...this.payloadPieces]).setDepth(20);
    this.seenSeparations = 0;
    this.debris = [];
    this.createExhaust();
    this.drawLaunchPad();
  },

  // The engines of every stage, each tagged with its stage and the height of
  // its nozzles; only the burning stage's are drawn.
  getEngineDefinitions() {
    const stages = this.rocketDef.stages;
    if (!stages?.length) {
      return this.rocketDef.engines.map((engine) => ({ ...engine, stage: 0, lift: 0 }));
    }
    return stages.flatMap((stage, index) =>
      (stage.engines || this.rocketDef.engines).map((engine) => ({ ...engine, stage: index, lift: this.stageEngineLift[index] })),
    );
  },

  // Shows the burning stage's engines and hides the rest.
  setActiveEngines(stageIndex) {
    this.allEngines.forEach((engine) => {
      if (engine.stage !== stageIndex) {
        [engine.glow, engine.outer, engine.inner, engine.core, ...engine.diamonds].forEach((part) => part.setVisible(false));
      }
    });
    this.engines = this.allEngines.filter((engine) => engine.stage === stageIndex);
    if (!this.engines.length) {
      this.engines = this.allEngines.slice(-1);
    }
    this.smokeWeights = this.engines.map((engine) => engine.propellant.smokeAmount);
    this.smokeWeight = this.smokeWeights.reduce((sum, weight) => sum + weight, 0) / this.engines.length;
  },

  // Called every frame: notices a new separation and plays it.
  updateStaging(state, delta) {
    if (state.separations > this.seenSeparations) {
      for (let index = this.seenSeparations; index < state.separations; index += 1) {
        this.dropStage(index, state);
      }
      this.seenSeparations = state.separations;
      this.setActiveEngines(state.stage);
    }
    this.updateDebris(delta / 1000);
  },

  dropStage(index, state) {
    const stageDef = this.rocketDef.stages?.[index];
    const pieces = this.stagePieces[index] || [];
    const rotation = this.rocket.rotation;
    const heading = { x: Math.sin(rotation), y: -Math.cos(rotation) };
    const side = { x: Math.cos(rotation), y: Math.sin(rotation) };
    const boosters = stageDef?.kind === "boosters";

    pieces.forEach((image) => {
      image.setVisible(false);
      const [left, , right] = image.cropShare;
      const centre = (left + right) / 2 - 0.5;
      const away = boosters ? Math.sign(centre) || 1 : 0;
      const copy = this.addWorldObject(
        this.add
          .image(this.rocket.x, this.rocket.y, image.texture.key)
          .setOrigin(0.5, 1)
          .setScale(image.scaleX)
          .setRotation(rotation)
          .setDepth(19.5),
      );
      copy.setCrop(image._crop.x, image._crop.y, image._crop.width, image._crop.height);
      // Side boosters peel outwards and tumble; in-line stages fall straight
      // back. Positions are kept relative to the rocket so the drop reads the
      // same at any speed.
      const u = this.rocketHeight;
      this.debris.push({
        image: copy,
        offset: { x: 0, y: 0 },
        velocity: {
          x: -heading.x * u * 0.08 + side.x * away * u * 0.18,
          y: -heading.y * u * 0.08 + side.y * away * u * 0.18,
        },
        pull: { x: -heading.x * u * 0.35, y: -heading.y * u * 0.35 },
        spin: away * 0.6 + Phaser.Math.FloatBetween(-0.15, 0.15),
        pivot: { x: centre * this.rocketWidth, y: 0 },
        life: DEBRIS_LIFE,
      });
    });

    // A puff and a ring of light at the joint, a jolt and the pyro bang.
    const lift = this.stageEngineLift[index + 1] ?? 0;
    const jointX = this.rocket.x + heading.x * lift;
    const jointY = this.rocket.y + heading.y * lift;
    const register = (obj) => this.addWorldObject(obj);
    const zoom = this.cameras.main.zoom;
    sparkles(this, jointX, jointY, {
      count: 22, colors: [0xffffff, 0xffe0a8, 0xffb347], speed: 90 / zoom, scale: 0.5 / zoom,
      depth: 22, register, scrollFactor: 1,
    });
    shockwave(this, jointX, jointY, { color: 0xffffff, radius: this.rocketWidth * 2.2, width: 2 / zoom, duration: 450, depth: 22, register, scrollFactor: 1 });
    this.cameras.main.shake(220, 0.004);
    this.audio?.playStageSeparation?.();
    this.showStageBanner(index, state);
  },

  updateDebris(dt) {
    if (!this.debris.length) {
      return;
    }
    this.debris = this.debris.filter((piece) => {
      piece.life -= dt;
      if (piece.life <= 0) {
        piece.image.destroy();
        return false;
      }
      // The rocket pulls away: the debris drifts back faster and faster.
      piece.velocity.x += piece.pull.x * dt;
      piece.velocity.y += piece.pull.y * dt;
      piece.offset.x += piece.velocity.x * dt;
      piece.offset.y += piece.velocity.y * dt;
      piece.image
        .setPosition(this.rocket.x + piece.offset.x, this.rocket.y + piece.offset.y)
        .setRotation(piece.image.rotation + piece.spin * dt)
        .setAlpha(Math.min(1, piece.life / 1.2));
      return true;
    });
  },

  // A short line under the HUD: which stage went and which one burns now.
  showStageBanner(index, state) {
    const stages = this.rocketDef.stages || [];
    const next = stages[state.stage];
    this.flashBanner(`Separación · ${stages[index]?.name || "etapa"}`, next ? `Ahora: ${next.name}` : "", "#ffe0a8");
  },

  // Big centred text in screen space that fades out on its own.
  flashBanner(title, subtitle = "", color = "#ffffff") {
    const { width, height } = this.scale;
    const y = Math.max(this.hud.panelBounds.y + this.hud.panelBounds.height + 70, height * 0.3);
    this.bannerObjects?.forEach((obj) => obj.destroy());
    const titleText = this.add
      .text(width / 2, y, title, {
        fontFamily: "Arial, sans-serif", fontSize: `${Math.round(Math.min(30, width * 0.06))}px`,
        fontStyle: "bold", color, stroke: "#08111f", strokeThickness: 6, align: "center",
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(900);
    const subtitleText = this.add
      .text(width / 2, y + 34, subtitle, {
        fontFamily: "Arial, sans-serif", fontSize: `${Math.round(Math.min(18, width * 0.04))}px`,
        color: "#f3f7fb", stroke: "#08111f", strokeThickness: 4, align: "center",
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(900);
    this.bannerObjects = [titleText, subtitleText];
    this.bannerObjects.forEach((obj) => {
      this.cameras.main.ignore(obj);
      this.backdropCamera?.ignore(obj);
      obj.setScale(1.15);
      this.tweens.add({ targets: obj, scale: 1, duration: 220, ease: "Back.easeOut" });
      this.tweens.add({ targets: obj, alpha: 0, delay: 1800, duration: 600, onComplete: () => obj.destroy() });
    });
  },
};
