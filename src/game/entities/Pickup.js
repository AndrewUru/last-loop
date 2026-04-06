import Phaser from "phaser";
import { GAME_BALANCE } from "../data/balance.js";

export default class Pickup {
  constructor(scene, x, y, type, value) {
    this.scene = scene;
    this.type = type;
    this.value = value;
    this.isAlive = true;

    const config = GAME_BALANCE.pickups[type];
    this.config = config;
    this.spawnTime = scene.time.now;

    this.sprite = scene.add.circle(x, y, config.radius, config.color).setDepth(2);
    this.sprite.setStrokeStyle(2, config.stroke, 0.85);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setCircle(config.radius);
    this.sprite.body.setCircle(config.radius, -config.radius, -config.radius);
    this.sprite.entity = this;

    const launchAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const launchForce = Phaser.Math.Between(20, 70);
    this.velocity = new Phaser.Math.Vector2(
      Math.cos(launchAngle) * launchForce,
      Math.sin(launchAngle) * launchForce,
    );
  }

  update(playerSprite, time) {
    if (!this.isAlive || !this.sprite.active) {
      return false;
    }

    const bob = Math.sin((time - this.spawnTime) / 120) * 0.35;
    this.sprite.scale = 1 + bob * 0.06;

    this.velocity.scale(0.92);
    this.sprite.x += this.velocity.x * 0.016;
    this.sprite.y += this.velocity.y * 0.016;

    const distance = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      playerSprite.x,
      playerSprite.y,
    );
    const player = this.scene.player;
    const magnetRange = this.config.magnetRange * (player?.pickupRangeMultiplier ?? 1);
    const moveSpeed = this.config.moveSpeed * (player?.pickupSpeedMultiplier ?? 1);

    if (distance <= magnetRange) {
      this.scene.physics.moveToObject(
        this.sprite,
        playerSprite,
        moveSpeed,
      );
    } else {
      this.sprite.body.setVelocity(0, 0);
    }

    return true;
  }

  destroy() {
    if (!this.isAlive) {
      return;
    }

    this.isAlive = false;
    if (this.sprite?.active) {
      this.sprite.destroy();
    }
  }
}
