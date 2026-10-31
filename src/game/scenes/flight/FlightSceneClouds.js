import Phaser from "phaser";
import { ART } from "../../data/art.js";

// Painted clouds around the pad, in rocket heights: base is the height of the
// cloud's flat bottom above the ground, along its distance from the pad
// (mirrored layers sit on either side, clear of the climb). They set the
// scene and give the climb something to pass.
const CLOUD_LAYERS = [
  { art: "cloudCumulus", count: 5, base: [0.05, 0.35], along: [1.2, 4.5], width: [0.6, 1.2], alpha: 0.8, tint: 0xdce8f5 },
  { art: "cloudCumulus", stormArt: "cloudStorm", count: 6, stormCount: 8, base: [0.9, 1.6], along: [1.1, 6], width: [1, 1.8], stormWidth: [1.6, 2.6], alpha: 0.95 },
  { art: "cloudStratus", count: 4, base: [2, 2.6], along: [1, 7], width: [2.5, 4], alpha: 0.75 },
];
// Rocket altitudes (km) between which the clouds fade out below the rocket.
const CLOUD_FADE_START = 15;
const CLOUD_FADE_END = 45;
// Cloud decks punched through on the way up, in km. A deck drawn to scale
// would take the rocket ten seconds to cross, so crossing one is a quick
// sweep of clouds in front of the camera with a veil of fog instead.
const CLOUD_DECKS = [4];
const STORM_DECKS = [3, 8];
const FLY_THROUGH_TIME = 1.4;
const FLY_THROUGH_CLOUDS = 5;
// The rocket must stay faintly visible through the sweep: in a storm the
// gusts keep pushing it while it is inside the cloud.
const FLY_THROUGH_ALPHA = [0.6, 0.8];
const STORM_FLY_THROUGH_ALPHA = [0.45, 0.62];
// Overcast and night skies dim white clouds into grey and blue-grey.
const STORM_TINT = 0xa3aebc;
const NIGHT_TINT = 0x56617a;

function between([min, max]) {
  return Phaser.Math.FloatBetween(min, max);
}

export const flightSceneCloudMethods = {
  createClouds() {
    const { night, wind } = this.rocketDef.challenge;
    const mobile =
      this.scale.width < 760 || (this.scale.width < 920 && this.scale.height > this.scale.width * 1.15);
    const unit = this.rocketHeight;
    this.clouds = [];
    this.cloudFade = -1;

    CLOUD_LAYERS.forEach((layer) => {
      const art = ART[wind && layer.stormArt ? layer.stormArt : layer.art];
      const count = Math.ceil((wind && layer.stormCount ? layer.stormCount : layer.count) * (mobile ? 0.6 : 1));
      const width = wind && layer.stormWidth ? layer.stormWidth : layer.width;
      let tint = layer.tint ?? 0xffffff;
      if (wind && !layer.stormArt) {
        tint = STORM_TINT;
      }
      if (night) {
        tint = NIGHT_TINT;
      }

      for (let index = 0; index < count; index += 1) {
        const image = this.add
          .image(0, 0, art.key)
          .setOrigin(0.5, 0.9)
          .setFlipX(Math.random() < 0.5)
          .setTint(tint)
          .setDepth(-8);
        image.setScale((between(width) * unit) / image.width);
        this.clouds.push({
          image,
          along: between(layer.along) * unit * (Math.random() < 0.5 ? -1 : 1),
          base: between(layer.base) * unit,
          alpha: layer.alpha * (night ? 0.75 : 1),
        });
      }
    });

    this.layoutClouds();
    this.createFlyThrough();
  },

  createFlyThrough() {
    const { night, wind } = this.rocketDef.challenge;
    const tint = night ? NIGHT_TINT : 0xffffff;
    this.cloudDecks = wind ? STORM_DECKS : CLOUD_DECKS;
    this.nextDeck = 0;
    this.flyThroughTime = 0;
    this.flyThroughClouds = Array.from({ length: FLY_THROUGH_CLOUDS }, () =>
      this.add
        .image(0, 0, ART[wind ? "cloudStorm" : "cloudCumulus"].key)
        .setScrollFactor(0)
        .setDepth(35)
        .setTint(tint)
        .setVisible(false),
    );
    this.cloudFog = this.add
      .rectangle(0, 0, 10, 10, wind ? 0x8a96a6 : night ? 0x27324a : 0xffffff, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(34)
      .setAlpha(0);
    this.lightning = wind
      ? this.add.rectangle(0, 0, 10, 10, 0xeef4ff, 1).setOrigin(0).setScrollFactor(0).setDepth(36).setAlpha(0)
      : null;
  },

  // Keeps every cloud over the same spot of ground while the flat horizon on
  // the pad bends into the round planet.
  layoutClouds() {
    if (!this.clouds || !this.groundShape) {
      return;
    }
    const { centerY, radius } = this.groundShape;
    this.clouds.forEach((cloud) => {
      const angle = cloud.along / radius;
      const distance = radius + cloud.base;
      cloud.image
        .setPosition(Math.sin(angle) * distance, centerY - Math.cos(angle) * distance)
        .setRotation(angle);
    });
  },

  updateClouds(state) {
    const t = Phaser.Math.Clamp(
      (state.altitude - CLOUD_FADE_START) / (CLOUD_FADE_END - CLOUD_FADE_START),
      0,
      1,
    );
    const fade = 1 - t * t * (3 - 2 * t);
    if (Math.abs(fade - this.cloudFade) >= 0.004) {
      this.cloudFade = fade;
      this.clouds.forEach((cloud) => {
        cloud.image.setAlpha(cloud.alpha * fade).setVisible(fade > 0.01);
      });
    }

    const deck = this.cloudDecks[this.nextDeck];
    if (deck !== undefined && state.altitude >= deck && state.verticalVelocity > 0) {
      this.nextDeck += 1;
      this.startFlyThrough(state);
    }
    this.updateFlyThrough(this.game.loop.delta / 1000);
  },

  startFlyThrough(state) {
    const { width, height } = this.scale;
    const speed = Math.hypot(state.velocity.x, state.velocity.y) || 1;
    // Clouds come from ahead of the rocket and rush out behind it.
    this.flyThroughDirection = { x: state.velocity.x / speed, y: state.velocity.y / speed };
    const forward = this.flyThroughDirection;
    const reach = Math.max(width, height);
    this.flyThroughTime = FLY_THROUGH_TIME;
    this.flyThroughClouds.forEach((image, index) => {
      image.setScale((width * Phaser.Math.FloatBetween(0.55, 1)) / image.width).setFlipX(Math.random() < 0.5);
      const ahead = reach * (0.55 + index * 0.35);
      const across = Phaser.Math.FloatBetween(-0.45, 0.45) * width;
      image
        .setPosition(
          width / 2 + forward.x * ahead - forward.y * across,
          height / 2 + forward.y * ahead + forward.x * across,
        )
        .setAlpha(between(this.lightning ? STORM_FLY_THROUGH_ALPHA : FLY_THROUGH_ALPHA))
        .setVisible(true);
      image.sweepSpeed = height * Phaser.Math.FloatBetween(2.2, 3);
    });
    this.lightningAt = this.lightning ? FLY_THROUGH_TIME * Phaser.Math.FloatBetween(0.35, 0.65) : -1;
    this.cameras.main.shake(350, 0.003);
  },

  updateFlyThrough(dt) {
    if (this.flyThroughTime <= 0) {
      return;
    }
    const { width, height } = this.scale;
    const before = this.flyThroughTime;
    this.flyThroughTime = Math.max(0, before - dt);
    const progress = 1 - this.flyThroughTime / FLY_THROUGH_TIME;
    const forward = this.flyThroughDirection;

    this.flyThroughClouds.forEach((image) => {
      image.x -= forward.x * image.sweepSpeed * dt;
      image.y -= forward.y * image.sweepSpeed * dt;
      if (this.flyThroughTime === 0) {
        image.setVisible(false);
      }
    });
    this.cloudFog.setSize(width, height).setAlpha(0.4 * Math.sin(Math.PI * progress));

    if (this.lightning) {
      if (before > this.lightningAt && this.flyThroughTime <= this.lightningAt) {
        this.lightningFlash = 0.75;
      }
      this.lightningFlash = Math.max(0, (this.lightningFlash || 0) - dt * 5);
      this.lightning.setSize(width, height).setAlpha(this.lightningFlash);
    }
  },

  getCloudObjects() {
    return this.clouds.map((cloud) => cloud.image);
  },

  // Screen-space pieces, drawn by the HUD camera under the HUD.
  getCloudUiObjects() {
    return [...this.flyThroughClouds, this.cloudFog, ...(this.lightning ? [this.lightning] : [])];
  },
};
