import Phaser from "phaser";
import { GAME_BALANCE } from "../data/balance.js";

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.add.circle(x, y, 16, 0x3db0ff).setDepth(1);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCircle(16);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setCircle(16, -16, -16);
    this.sprite.entity = this;

    this.health = GAME_BALANCE.player.maxHealth;
    this.maxHealth = GAME_BALANCE.player.maxHealth;
    this.moveSpeed = GAME_BALANCE.player.speed;
    this.damage = GAME_BALANCE.player.damage;
    this.fireRate = GAME_BALANCE.player.fireRate;
    this.attackRange = GAME_BALANCE.player.attackRange;
    this.bulletSpeed = GAME_BALANCE.player.bulletSpeed;
    this.bulletLifetime = GAME_BALANCE.player.bulletLifetime;
    this.projectileCount = 1;
    this.projectileSpread = GAME_BALANCE.player.projectileSpread;
    this.nextShot = 0;
    this.invulnerabilityDuration = GAME_BALANCE.player.invulnerability;
    this.invulnerableUntil = 0;
    this.knockback = new Phaser.Math.Vector2();
    this.pickupRangeMultiplier = GAME_BALANCE.player.pickupRangeMultiplier;
    this.pickupSpeedMultiplier = GAME_BALANCE.player.pickupSpeedMultiplier;
    this.regenPerSecond = 0;

    this.aura = scene.add
      .circle(x, y, 24, 0x75f6ff, 0.12)
      .setDepth(0);
    this.healthBarBg = scene.add
      .rectangle(x, y - 30, 48, 6, 0x112235, 0.95)
      .setOrigin(0.5)
      .setDepth(3);
    this.healthBarFill = scene.add
      .rectangle(x - 24, y - 30, 48, 6, 0x48f2a3)
      .setOrigin(0, 0.5)
      .setDepth(4);
  }

  update(keys, time) {
    const body = this.sprite.body;
    body.setVelocity(0);

    if (keys.left.isDown) {
      body.setVelocityX(-this.moveSpeed);
    }
    if (keys.right.isDown) {
      body.setVelocityX(this.moveSpeed);
    }
    if (keys.up.isDown) {
      body.setVelocityY(-this.moveSpeed);
    }
    if (keys.down.isDown) {
      body.setVelocityY(this.moveSpeed);
    }

    body.velocity.normalize().scale(this.moveSpeed);
    body.velocity.x += this.knockback.x;
    body.velocity.y += this.knockback.y;
    this.knockback.scale(0.84);
    this.sprite.rotation =
      body.velocity.length() > 0
        ? Phaser.Math.Angle.Between(0, 0, body.velocity.x, body.velocity.y)
        : this.sprite.rotation;

    this.aura.setPosition(this.sprite.x, this.sprite.y);
    this.aura.scale = 1 + Math.sin(time / 180) * 0.04;
    this.updateHealthBar();
    this.updateInvulnerabilityVisual(time);
  }

  canShoot(time) {
    return time >= this.nextShot;
  }

  markShot(time) {
    this.nextShot = time + this.fireRate;
  }

  takeDamage(amount, time) {
    if (time < this.invulnerableUntil) {
      return false;
    }

    this.invulnerableUntil = time + this.invulnerabilityDuration;
    this.health -= amount;
    this.health = Math.max(0, this.health);
    return true;
  }

  isAlive() {
    return this.health > 0;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  addMaxHealth(amount) {
    this.maxHealth += amount;
    this.heal(amount);
  }

  applyKnockback(sourceX, sourceY, force = GAME_BALANCE.player.knockbackForce) {
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.sprite.x, this.sprite.y);
    this.knockback.x += Math.cos(angle) * force;
    this.knockback.y += Math.sin(angle) * force;
  }

  updateHealthBar() {
    const ratio = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
    const barX = this.sprite.x - 24;
    const barY = this.sprite.y - 30;

    this.healthBarBg.setPosition(this.sprite.x, barY);
    this.healthBarFill.setPosition(barX, barY);
    this.healthBarFill.scaleX = ratio;
    this.healthBarFill.setVisible(ratio > 0);
  }

  updateInvulnerabilityVisual(time) {
    if (time < this.invulnerableUntil) {
      this.sprite.alpha = Math.floor(time / 70) % 2 === 0 ? 0.45 : 0.95;
      this.aura.alpha = 0.2;
      return;
    }

    this.sprite.alpha = 1;
    this.aura.alpha = 0.12;
  }

  destroy() {
    if (this.aura?.active) {
      this.aura.destroy();
    }
    if (this.healthBarBg?.active) {
      this.healthBarBg.destroy();
    }
    if (this.healthBarFill?.active) {
      this.healthBarFill.destroy();
    }
    if (this.sprite?.active) {
      this.sprite.destroy();
    }
  }
}
