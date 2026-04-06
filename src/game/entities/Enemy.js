import Phaser from "phaser";
import { GAME_BALANCE } from "../data/balance.js";

export default class Enemy {
  constructor(scene, x, y, type = "normal") {
    this.scene = scene;
    this.type = type;
    this.isAlive = true;

    const config = this.getTypeConfig(type);
    this.radius = config.radius;
    this.baseColor = config.color;
    this.sprite = scene.add
      .circle(x, y, config.radius, config.color)
      .setDepth(1);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCircle(config.radius);
    this.sprite.body.setCircle(config.radius, -config.radius, -config.radius);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setBounce(1, 1);
    this.sprite.entity = this;

    this.speed = config.speed;
    this.health = config.health;
    this.maxHealth = config.health;
    this.touchDamage = config.damage;
    this.scoreValue = config.scoreValue;
    this.xpValue = config.xpValue;
    this.knockbackResistance = config.knockbackResistance;
    this.knockback = new Phaser.Math.Vector2();
    this.motionSeed = Phaser.Math.FloatBetween(0, Math.PI * 2);

    if (type === "fast") {
      this.sprite.setStrokeStyle(2, 0xfff2b3, 0.9);
    } else if (type === "tank") {
      this.sprite.setStrokeStyle(4, 0x3a150f, 0.9);
    } else {
      this.sprite.setStrokeStyle(2, 0x35131a, 0.8);
    }
  }

  getTypeConfig(type) {
    const enemyConfig = GAME_BALANCE.enemies[type] || GAME_BALANCE.enemies.normal;

    return {
      color: enemyConfig.color,
      radius: enemyConfig.radius,
      speed: enemyConfig.speed,
      health: enemyConfig.health,
      damage: enemyConfig.damage,
      scoreValue: enemyConfig.score,
      xpValue: enemyConfig.xp,
      knockbackResistance: enemyConfig.knockbackResistance,
    };
  }

  update(targetSprite) {
    if (!this.isAlive) {
      return;
    }

    const angle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      targetSprite.x,
      targetSprite.y,
    );
    const speed = this.getCurrentSpeed();

    this.scene.physics.velocityFromRotation(angle, speed, this.sprite.body.velocity);

    if (this.type === "fast") {
      const sidestep = Math.sin(this.scene.time.now / 180 + this.motionSeed) * 45;
      this.sprite.body.velocity.x += -Math.sin(angle) * sidestep;
      this.sprite.body.velocity.y += Math.cos(angle) * sidestep;
      this.sprite.rotation += 0.12;
    } else if (this.type === "tank") {
      this.sprite.rotation = Math.sin(this.scene.time.now / 400 + this.motionSeed) * 0.08;
      this.sprite.scale = 1 + Math.sin(this.scene.time.now / 220) * 0.03;
    } else {
      this.sprite.rotation = angle;
    }

    this.sprite.body.velocity.x += this.knockback.x;
    this.sprite.body.velocity.y += this.knockback.y;
    this.knockback.scale(0.82);
  }

  getCurrentSpeed() {
    if (this.type === "fast") {
      return this.speed + Math.sin(this.scene.time.now / 160 + this.motionSeed) * 14;
    }

    return this.speed;
  }

  takeDamage(amount) {
    this.health -= amount;

    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      return true;
    }

    this.sprite.setFillStyle(0xffffff);
    this.scene.tweens.add({
      targets: this.sprite,
      scale: 1.12,
      yoyo: true,
      duration: 70,
      onComplete: () => {
        if (this.sprite.active) {
          this.sprite.setFillStyle(this.baseColor);
        }
      },
    });

    return false;
  }

  applyKnockback(sourceX, sourceY, force = 140) {
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.sprite.x, this.sprite.y);
    const adjustedForce = force / this.knockbackResistance;

    this.knockback.x += Math.cos(angle) * adjustedForce;
    this.knockback.y += Math.sin(angle) * adjustedForce;
  }

  destroy() {
    if (this.sprite && this.sprite.active) {
      this.sprite.destroy();
    }
  }
}
