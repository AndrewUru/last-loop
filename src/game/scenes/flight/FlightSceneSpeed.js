import Phaser from "phaser";
import { createShadedTexture } from "./FlightSceneExhaust.js";

const VAPOR_CONE_TIME = 0.8;
const VAPOR_TEXTURE = "fx-vapor-cone";

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
  },

  getSpeedBackdropObjects() {
    return [this.speedLines];
  },

  getSpeedWorldObjects() {
    return [this.vaporCone];
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
  },

  updateStreaks(state, direction, dt) {
    const { width, height } = this.scale;
    const graphics = this.speedLines;
    graphics.clear();

    // Thick air makes bold streaks; in space a faint dust keeps the motion going.
    const pace = Phaser.Math.Clamp((state.speed - 0.15) / 1.2, 0, 1);
    const alpha = this.finished || state.orbitAchieved ? 0 : pace * (0.3 + 0.7 * state.atmosphereDensity);
    if (alpha <= 0.01) {
      this.streaks.forEach((streak) => {
        streak.placed = false;
      });
      return;
    }

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
      graphics.lineStyle(1 + streak.depth * 1.5, 0xffffff, alpha * streak.depth * 0.7);
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
