import Phaser from "phaser";
import { createShadedTexture } from "./FlightSceneExhaust.js";

const VAPOR_CONE_TIME = 0.8;
const VAPOR_TEXTURE = "fx-vapor-cone";
const PLASMA_TEXTURE = "fx-reentry-plasma";
const PLASMA_COOL = 0xff5a1f;
const PLASMA_HOT = 0xffe2a8;
// Keep liftoff clear. Streaks build only once the vehicle is well above the
// launch site and moving fast, rather than appearing at the first acceleration.
const STREAK_ALTITUDE_START = 12;
const STREAK_ALTITUDE_FULL = 35;
const STREAK_SPEED_START = 1.2;
const STREAK_SPEED_FULL = 3.5;

function isMobile(scale) {
  return scale.width < 760 || (scale.width < 920 && scale.height > scale.width * 1.15);
}

// Arcade cues for speed. The world is small next to the speeds involved, so
// real motion past the camera is slow; these streaks and drifts are scaled
// from the rocket's speed instead.
export const flightSceneSpeedMethods = {
  createSpeedEffects() {
    const mobile = isMobile(this.scale);

    // Air rushing past, drawn in screen space behind the world.
    this.speedLines = this.add.graphics().setScrollFactor(0).setDepth(-30);
    this.streaks = Array.from({ length: mobile ? 26 : 46 }, () => ({
      x: 0,
      y: 0,
      depth: Phaser.Math.FloatBetween(0.35, 1),
      placed: false,
    }));
    this.starDepths = this.stars.map(() => Phaser.Math.FloatBetween(0.2, 1));

    // Vapor cone: the white shroud that forms around a rocket breaking the
    // sound barrier. Seen from the side it is densest along its outline, which
    // also keeps it visible over a white rocket.
    createShadedTexture(this, VAPOR_TEXTURE, 64, 64, (u, v) => {
      const across = Math.abs(u * 2 - 1) / (0.12 + 0.88 * v);
      if (across >= 1) {
        return [255, 0];
      }
      const shell = 0.35 + 0.65 * across ** 2.5;
      return [255, shell * (1 - across ** 16) * (1 - v) ** 0.4 * Math.min(1, v / 0.08)];
    });
    this.vaporCone = this.add
      .image(0, 0, VAPOR_TEXTURE)
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setVisible(false);
    this.vaporTime = 0;

    // Reentry plasma: a bow shock hugging the leading side of the rocket,
    // brightest at the stagnation point and streaming back past the tail.
    createShadedTexture(this, PLASMA_TEXTURE, 64, 96, (u, v) => {
      const across = Math.abs(u * 2 - 1) / (0.22 + 0.78 * Math.sqrt(v));
      if (across >= 1) {
        return [255, 0];
      }
      const core = (1 - across) ** 1.6 * (1 - v) ** 1.8;
      const shell = across ** 3 * (1 - v) ** 0.9 * 0.7;
      return [255, Math.min(1, (core + shell) * Math.min(1, v / 0.05))];
    });
    this.reentryPlasma = this.add
      .image(0, 0, PLASMA_TEXTURE)
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.reentryTail = this.add
      .image(0, 0, PLASMA_TEXTURE)
      .setOrigin(0.5, 0)
      .setDepth(19)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    // Screen-space orange wash so the whole view feels the heat.
    this.reentryWash = this.add.graphics().setScrollFactor(0).setDepth(-29);
  },

  getSpeedBackdropObjects() {
    return [this.speedLines, this.reentryWash];
  },

  getSpeedWorldObjects() {
    return [this.vaporCone, this.reentryPlasma, this.reentryTail];
  },

  showVaporCone() {
    this.vaporTime = VAPOR_CONE_TIME;
    this.updateVaporCone(0);
    this.cameras.main.shake(220, 0.005);
  },

  updateSpeedEffects(state, delta) {
    const dt = delta / 1000;
    const heading = Math.hypot(state.velocity.x, state.velocity.y);
    // Gusts slant the streaks, so a storm shows in the air as well as in the controls.
    const angle = (heading > 0.001 ? Math.atan2(state.velocity.y, state.velocity.x) : -Math.PI / 2) + state.windGust * 0.5;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    this.updateStreaks(state, direction, dt);
    this.updateStarDrift(state, direction, dt);
    this.updateVaporCone(dt);
    this.updateReentryPlasma(state, angle);
  },

  updateReentryPlasma(state, velocityAngle) {
    const heat = this.finished ? 0 : state.reentryHeat || 0;
    const visible = heat > 0.02;
    this.reentryPlasma.setVisible(visible);
    this.reentryTail.setVisible(visible);
    this.reentryWash.clear();
    if (!visible) {
      return;
    }

    const flicker = 0.85 + Math.random() * 0.15;
    const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(PLASMA_COOL),
      Phaser.Display.Color.ValueToColor(PLASMA_HOT),
      100,
      Math.round(heat * heat * 100),
    );
    const color = Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b);

    // Rocket centre (its origin is the tail) and how far it reaches along the
    // direction of travel, so the shock sits just ahead of whichever end leads.
    const nose = this.getVisualOrientation();
    const centerX = this.rocket.x + Math.cos(nose) * this.rocketHeight * 0.5;
    const centerY = this.rocket.y + Math.sin(nose) * this.rocketHeight * 0.5;
    const along = Math.abs(Math.cos(nose - velocityAngle)) * this.rocketHeight * 0.5;
    const across = Math.abs(Math.sin(nose - velocityAngle)) * this.rocketHeight * 0.5;
    const reach = along + this.rocketWidth * 0.5 + across * 0.2;
    const lead = reach + this.rocketWidth * 0.35;
    const dirX = Math.cos(velocityAngle);
    const dirY = Math.sin(velocityAngle);
    // The texture's tip is at its top edge and it grows downwards; turn it so
    // the tip sits ahead of the rocket and the glow streams back over it.
    const rotation = velocityAngle + Math.PI / 2;
    const width = Math.max(this.rocketWidth * 2.4, across * 2.2 + this.rocketWidth * 1.6);

    this.reentryPlasma
      .setPosition(centerX + dirX * lead, centerY + dirY * lead)
      .setRotation(rotation + (Math.random() - 0.5) * 0.04)
      .setDisplaySize(width * (0.8 + heat * 0.4), (reach * 2 + this.rocketHeight * 0.6) * (0.7 + heat * 0.6))
      .setTint(color)
      .setAlpha(Math.min(1, heat * 1.3) * flicker);
    this.reentryTail
      .setPosition(centerX + dirX * reach * 0.4, centerY + dirY * reach * 0.4)
      .setRotation(rotation)
      .setDisplaySize(width * 1.5, (reach * 2 + this.rocketHeight * 1.8) * (0.8 + heat))
      .setTint(PLASMA_COOL)
      .setAlpha(heat * 0.45 * flicker);

    const { width: screenWidth, height: screenHeight } = this.scale;
    this.reentryWash.fillStyle(PLASMA_COOL, heat * 0.16 * flicker);
    this.reentryWash.fillRect(0, 0, screenWidth, screenHeight);
  },

  updateStreaks(state, direction, dt) {
    const { width, height } = this.scale;
    const graphics = this.speedLines;
    graphics.clear();

    // Both altitude and speed fade in smoothly: clearing the tower alone
    // should not make the whole sky look like high-speed flight.
    const clearance = Phaser.Math.SmoothStep(state.altitude, STREAK_ALTITUDE_START, STREAK_ALTITUDE_FULL);
    const pace = Phaser.Math.SmoothStep(state.speed, STREAK_SPEED_START, STREAK_SPEED_FULL);
    // Thick air makes bold streaks; in space a faint dust keeps the motion going.
    const alpha = !state.launched || this.finished || state.orbitAchieved
      ? 0
      : clearance * pace * (0.3 + 0.7 * state.atmosphereDensity);
    if (alpha <= 0.01) {
      this.streaks.forEach((streak) => {
        streak.placed = false;
      });
      return;
    }

    // Hot air glows: streaks turn orange during reentry.
    const streakColor = (state.reentryHeat || 0) > 0.05 ? 0xffb066 : 0xffffff;
    const centerX = width / 2;
    const centerY = height / 2;
    const diagonal = Math.hypot(width, height);
    const pixelSpeed = 300 + 1400 * Phaser.Math.Clamp(state.speed / 5, 0, 1);
    const length = 20 + 140 * Phaser.Math.Clamp(state.speed / 4, 0, 1);
    // Streaks come in from ahead of the rocket and rush out behind it.
    const place = (streak, anywhere) => {
      const across = (Math.random() - 0.5) * diagonal;
      const ahead = anywhere ? (Math.random() - 0.5) * diagonal : diagonal * (0.5 + Math.random() * 0.3);
      streak.x = centerX - direction.y * across + direction.x * ahead;
      streak.y = centerY + direction.x * across + direction.y * ahead;
      streak.placed = true;
    };

    this.streaks.forEach((streak) => {
      if (!streak.placed) {
        place(streak, true);
      }
      streak.x -= direction.x * pixelSpeed * streak.depth * dt;
      streak.y -= direction.y * pixelSpeed * streak.depth * dt;
      if ((streak.x - centerX) * direction.x + (streak.y - centerY) * direction.y < -diagonal * 0.6) {
        place(streak, false);
      }
      const streakLength = length * streak.depth;
      graphics.lineStyle(1 + streak.depth * 1.5, streakColor, alpha * streak.depth * 0.7);
      graphics.lineBetween(
        streak.x,
        streak.y,
        streak.x + direction.x * streakLength,
        streak.y + direction.y * streakLength,
      );
    });
  },

  // Stars slide past at different depths once there is space to see them.
  updateStarDrift(state, direction, dt) {
    if (this.stars[0]?.alpha <= 0.01 || state.orbitAchieved) {
      return;
    }
    const { width, height } = this.scale;
    const pace = state.speed * 6;
    this.stars.forEach((star, index) => {
      const drift = pace * this.starDepths[index] * dt;
      star.setPosition(
        Phaser.Math.Wrap(star.x - direction.x * drift, 0, width),
        Phaser.Math.Wrap(star.y - direction.y * drift, 0, height),
      );
    });
  },

  updateVaporCone(dt) {
    if (this.vaporTime <= 0) {
      return;
    }
    this.vaporTime = Math.max(0, this.vaporTime - dt);
    const life = this.vaporTime / VAPOR_CONE_TIME;
    // It wraps the rocket a little below the nose and trails towards the tail.
    const rotation = this.rocket.rotation;
    const up = this.rocketHeight * 0.62;
    this.vaporCone
      .setVisible(this.vaporTime > 0)
      .setPosition(this.rocket.x + Math.sin(rotation) * up, this.rocket.y - Math.cos(rotation) * up)
      .setRotation(rotation)
      .setDisplaySize(
        Math.max(this.rocketWidth * 2.6, this.rocketHeight * 0.45) * (1 + (1 - life) * 0.6),
        this.rocketHeight * 0.55,
      )
      .setAlpha(life);
  },
};
