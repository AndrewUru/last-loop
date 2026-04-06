import Phaser from "phaser";
import Player from "../entities/Player.js";
import Bullet from "../entities/Bullet.js";
import Pickup from "../entities/Pickup.js";
import Spawner from "../systems/Spawner.js";
import AutoAttack from "../systems/AutoAttack.js";
import UpgradeSystem from "../systems/UpgradeSystem.js";
import SoundSystem from "../systems/SoundSystem.js";
import { GAME_BALANCE } from "../data/balance.js";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    this.isGameOver = false;
    this.isChoosingUpgrade = false;
    this.startTime = this.time.now;
    this.survivalTime = 0;
    this.remainingTime = GAME_BALANCE.goal.targetTime;
    this.kills = 0;
    this.level = 1;
    this.experience = 0;
    this.experienceToNextLevel = GAME_BALANCE.progression.baseXpToLevel;
    this.pendingLevelUps = 0;
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.score = this.calculateScore();

    this.cameras.main.setBackgroundColor("#050816");
    this.syncWorldSize(this.scale.width, this.scale.height);
    this.buildArenaBackground(this.scale.width, this.scale.height);

    const { width, height } = this.scale;
    this.player = new Player(this, width / 2, height / 2);
    this.player.sprite.setDepth(5);

    this.enemiesGroup = this.physics.add.group();
    this.bulletsGroup = this.physics.add.group();
    this.pickupsGroup = this.physics.add.group();

    this.spawner = new Spawner(this);
    this.autoAttack = new AutoAttack(this);
    this.upgradeSystem = new UpgradeSystem(this);
    this.soundSystem = new SoundSystem(this);

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.physics.add.overlap(
      this.bulletsGroup,
      this.enemiesGroup,
      this.onBulletHitEnemy,
      null,
      this,
    );
    this.physics.add.overlap(
      this.player.sprite,
      this.enemiesGroup,
      this.onPlayerHit,
      null,
      this,
    );
    this.physics.add.overlap(
      this.player.sprite,
      this.pickupsGroup,
      this.onPlayerPickup,
      null,
      this,
    );

    this.damageFlash = this.add
      .rectangle(0, 0, width, height, GAME_BALANCE.feedback.hitFlashColor, 0)
      .setOrigin(0)
      .setDepth(40)
      .setScrollFactor(0);

    this.ambientTimer = this.time.addEvent({
      delay: 6000,
      loop: true,
      callback: () => this.soundSystem.ambientPulse(),
    });

    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.spawnWave();
  }

  update(time, delta) {
    if (this.isGameOver) {
      return;
    }

    this.survivalTime = Math.floor((this.time.now - this.startTime) / 1000);
    this.remainingTime = Math.max(
      0,
      GAME_BALANCE.goal.targetTime - this.survivalTime,
    );
    this.score = this.calculateScore();

    if (this.remainingTime <= 0) {
      this.endGame(true);
      return;
    }

    this.updateArenaBackground(time);
    this.player.update(this.keys, time);
    this.applyPassiveRegen(delta);
    this.autoAttack.update(time);

    this.enemies.forEach((enemy) => {
      if (enemy.isAlive) {
        enemy.update(this.player.sprite);
      }
    });

    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];

      if (!bullet.isAlive || !bullet.update(time)) {
        this.removeBullet(bullet, false);
      }
    }

    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];

      if (!pickup.isAlive || !pickup.update(this.player.sprite, time)) {
        this.removePickup(pickup);
      }
    }
  }

  buildArenaBackground(width, height) {
    this.arenaGrid?.destroy();
    this.arenaGlow?.destroy();
    this.arenaVignette?.destroy();
    this.arenaFrame?.destroy();
    this.ambientStars?.forEach((star) => star.dot.destroy());

    this.arenaGlow = this.add
      .circle(width / 2, height / 2, Math.max(width, height) * 0.42, 0x10365a, 0.14)
      .setDepth(-10)
      .setScrollFactor(0);

    this.arenaGrid = this.add.graphics().setDepth(-9).setScrollFactor(0);
    this.arenaGrid.lineStyle(1, 0x75f6ff, 0.05);
    for (let x = 0; x <= width; x += 64) {
      this.arenaGrid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 64) {
      this.arenaGrid.lineBetween(0, y, width, y);
    }

    this.arenaFrame = this.add.graphics().setDepth(-8).setScrollFactor(0);
    this.arenaFrame.lineStyle(2, 0x75f6ff, 0.1);
    this.arenaFrame.strokeRect(14, 14, width - 28, height - 28);

    this.arenaVignette = this.add.graphics().setDepth(30).setScrollFactor(0);
    this.drawVignette(width, height);

    this.ambientStars = Array.from({ length: 50 }, () => {
      const dot = this.add
        .circle(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(0, height),
          Phaser.Math.FloatBetween(1, 2.5),
          Phaser.Math.Between(0xffffff, 0xaad8ff),
          Phaser.Math.FloatBetween(0.12, 0.55),
        )
        .setDepth(-11)
        .setScrollFactor(0);

      return {
        dot,
        speed: Phaser.Math.FloatBetween(0.08, 0.3),
        drift: Phaser.Math.FloatBetween(-0.02, 0.02),
      };
    });
  }

  drawVignette(width, height) {
    this.arenaVignette.clear();
    this.arenaVignette.fillStyle(0x02040a, 0.28);
    this.arenaVignette.fillRect(0, 0, width, 40);
    this.arenaVignette.fillRect(0, height - 40, width, 40);
    this.arenaVignette.fillRect(0, 0, 40, height);
    this.arenaVignette.fillRect(width - 40, 0, 40, height);
  }

  updateArenaBackground(time) {
    if (!this.ambientStars) {
      return;
    }

    this.arenaGlow.scale = 1 + Math.sin(time / 1400) * 0.02;

    this.ambientStars.forEach((star) => {
      star.dot.y += star.speed;
      star.dot.x += star.drift;

      if (star.dot.y > this.scale.height + 6) {
        star.dot.y = -6;
        star.dot.x = Phaser.Math.Between(0, this.scale.width);
      }
      if (star.dot.x < -6) {
        star.dot.x = this.scale.width + 6;
      }
      if (star.dot.x > this.scale.width + 6) {
        star.dot.x = -6;
      }
    });
  }

  syncWorldSize(width, height) {
    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.setBounds(0, 0, width, height);
    this.cameras.main.setViewport(0, 0, width, height);
    this.damageFlash?.setSize(width, height);
  }

  handleResize(gameSize) {
    const { width, height } = gameSize;

    this.syncWorldSize(width, height);
    this.buildArenaBackground(width, height);

    if (!this.player?.sprite?.active) {
      return;
    }

    this.player.sprite.x = Phaser.Math.Clamp(this.player.sprite.x, 16, width - 16);
    this.player.sprite.y = Phaser.Math.Clamp(this.player.sprite.y, 16, height - 16);
  }

  handleShutdown() {
    this.scale.off("resize", this.handleResize, this);
  }

  applyPassiveRegen(delta) {
    if (this.player.regenPerSecond <= 0 || this.player.health >= this.player.maxHealth) {
      return;
    }

    this.player.heal((delta / 1000) * this.player.regenPerSecond);
  }

  calculateScore() {
    return (
      this.kills * GAME_BALANCE.score.killMultiplier +
      this.level * GAME_BALANCE.score.levelMultiplier +
      Math.floor(this.survivalTime * GAME_BALANCE.score.timeMultiplier)
    );
  }

  scheduleNextWave(delay) {
    this.spawnTimer = this.time.delayedCall(delay, this.spawnWave, [], this);
  }

  spawnWave() {
    if (this.isGameOver) {
      return;
    }

    const profile = this.getSpawnProfile();

    for (let count = 0; count < profile.count; count += 1) {
      this.spawnEnemy(this.chooseEnemyType(profile.types));
    }

    this.scheduleNextWave(profile.delay);
  }

  getSpawnProfile() {
    return (
      GAME_BALANCE.spawn.stages.find(
        (stage) => this.survivalTime < stage.until,
      ) || GAME_BALANCE.spawn.stages.at(-1)
    );
  }

  spawnEnemy(enemyType) {
    const enemy = this.spawner.spawnEnemy(enemyType);
    this.enemies.push(enemy);
    this.enemiesGroup.add(enemy.sprite);
  }

  chooseEnemyType(pool) {
    return Phaser.Utils.Array.GetRandom(pool);
  }

  spawnPickup(type, value, x, y) {
    const pickup = new Pickup(this, x, y, type, value);
    this.pickups.push(pickup);
    this.pickupsGroup.add(pickup.sprite);
  }

  onBulletHitEnemy(bulletSprite, enemySprite) {
    const bullet = bulletSprite.entity;
    const enemy = enemySprite.entity;

    if (!bullet || !enemy || !enemy.isAlive || !bullet.isAlive) {
      return;
    }

    const killed = enemy.takeDamage(bullet.damage);
    enemy.applyKnockback(this.player.sprite.x, this.player.sprite.y, 130);
    this.showFloatingText(
      enemy.sprite.x,
      enemy.sprite.y - 24,
      `${Math.round(bullet.damage)}`,
      "#ffd166",
      14,
    );
    this.soundSystem.hit();
    this.cameras.main.shake(
      GAME_BALANCE.feedback.enemyHitShake,
      GAME_BALANCE.feedback.enemyHitIntensity,
    );
    this.removeBullet(bullet, true);

    if (killed) {
      this.kills += 1;
      this.soundSystem.enemyDown();
      this.cameras.main.shake(
        GAME_BALANCE.feedback.enemyKillShake,
        GAME_BALANCE.feedback.enemyKillIntensity,
      );
      this.spawnPickup("xp", enemy.xpValue, enemy.sprite.x, enemy.sprite.y);
      this.trySpawnHealthPickup(enemy.sprite.x, enemy.sprite.y);
      this.removeEnemy(enemy);
    }
  }

  onPlayerHit(playerSprite, enemySprite) {
    const enemy = enemySprite.entity;
    const time = this.time.now;

    if (!enemy || !enemy.isAlive) {
      return;
    }

    const wasDamaged = this.player.takeDamage(enemy.touchDamage, time);

    if (!wasDamaged) {
      return;
    }

    this.player.applyKnockback(enemy.sprite.x, enemy.sprite.y);
    enemy.applyKnockback(this.player.sprite.x, this.player.sprite.y, 80);
    this.flashDamage();
    this.soundSystem.playerHit();
    this.cameras.main.shake(
      GAME_BALANCE.feedback.playerHitShake,
      GAME_BALANCE.feedback.playerHitIntensity,
    );
    this.showFloatingText(
      this.player.sprite.x,
      this.player.sprite.y - 40,
      `-${enemy.touchDamage}`,
      "#ff7b89",
      14,
    );
    this.emitBurst(this.player.sprite.x, this.player.sprite.y, 0xff7b89, 6, 10);

    if (!this.player.isAlive()) {
      this.endGame(false);
    }
  }

  onPlayerPickup(playerSprite, pickupSprite) {
    const pickup = pickupSprite.entity;

    if (!pickup || !pickup.isAlive) {
      return;
    }

    if (pickup.type === "heal" && this.player.health >= this.player.maxHealth) {
      return;
    }

    if (pickup.type === "xp") {
      this.gainExperience(pickup.value, pickup.sprite.x, pickup.sprite.y);
      this.showFloatingText(
        pickup.sprite.x,
        pickup.sprite.y - 18,
        `+${pickup.value} XP`,
        "#75f6ff",
        14,
      );
      this.soundSystem.pickupXp();
    } else if (pickup.type === "heal") {
      this.player.heal(pickup.value);
      this.showFloatingText(
        pickup.sprite.x,
        pickup.sprite.y - 18,
        `+${pickup.value} HP`,
        "#57f287",
        14,
      );
      this.soundSystem.pickupHeal();
    }

    this.emitBurst(
      pickup.sprite.x,
      pickup.sprite.y,
      pickup.config.color,
      6,
      pickup.config.radius,
    );
    this.removePickup(pickup);
  }

  spawnBullet(angle) {
    const bullet = new Bullet(
      this,
      this.player.sprite.x,
      this.player.sprite.y,
      angle,
      this.player.damage,
      this.player.bulletSpeed,
      this.player.bulletLifetime,
    );
    this.bullets.push(bullet);
    this.bulletsGroup.add(bullet.sprite);
  }

  removeBullet(bullet, withEffect = true) {
    if (!bullet) {
      return;
    }

    const x = bullet.sprite?.x ?? 0;
    const y = bullet.sprite?.y ?? 0;
    const index = this.bullets.indexOf(bullet);

    if (index !== -1) {
      this.bullets.splice(index, 1);
    }

    if (bullet.sprite) {
      this.bulletsGroup.remove(bullet.sprite, false, false);
    }

    if (withEffect) {
      this.emitBurst(x, y, 0xaefcff, 4, 6);
    }

    bullet.destroy();
  }

  removeEnemy(enemy) {
    if (!enemy) {
      return;
    }

    const x = enemy.sprite.x;
    const y = enemy.sprite.y;
    const index = this.enemies.indexOf(enemy);

    if (index !== -1) {
      this.enemies.splice(index, 1);
    }

    this.enemiesGroup.remove(enemy.sprite, false, false);
    enemy.sprite.body.enable = false;
    this.emitBurst(x, y, enemy.baseColor, 8, enemy.radius);
    this.tweens.add({
      targets: enemy.sprite,
      alpha: 0,
      scale: 1.4,
      duration: 160,
      ease: "Quad.easeOut",
      onComplete: () => enemy.destroy(),
    });
  }

  removePickup(pickup) {
    if (!pickup) {
      return;
    }

    const index = this.pickups.indexOf(pickup);
    if (index !== -1) {
      this.pickups.splice(index, 1);
    }

    if (pickup.sprite) {
      this.pickupsGroup.remove(pickup.sprite, false, false);
    }

    pickup.destroy();
  }

  trySpawnHealthPickup(x, y) {
    if (Math.random() > GAME_BALANCE.pickups.heal.chance) {
      return;
    }

    this.spawnPickup("heal", GAME_BALANCE.pickups.heal.value, x, y);
  }

  gainExperience(amount, x, y) {
    this.experience += amount;

    while (this.experience >= this.experienceToNextLevel) {
      this.experience -= this.experienceToNextLevel;
      this.level += 1;
      this.pendingLevelUps += 1;
      this.experienceToNextLevel = Math.round(
        this.experienceToNextLevel * GAME_BALANCE.progression.xpGrowth,
      );
      this.showFloatingText(x, y - 36, `Level ${this.level}!`, "#ffffff", 18);
      this.soundSystem.levelUp();
      this.triggerLevelShockwave();
    }

    if (this.pendingLevelUps > 0 && !this.isChoosingUpgrade) {
      this.openUpgradeSelection();
    }
  }

  triggerLevelShockwave() {
    const { x, y } = this.player.sprite;
    const shockwave = GAME_BALANCE.progression.levelShockwave;

    const ring = this.add
      .circle(x, y, 18, 0x75f6ff, 0.12)
      .setStrokeStyle(4, 0xdafcff, 0.95)
      .setDepth(6);

    this.tweens.add({
      targets: ring,
      radius: shockwave.radius,
      alpha: 0,
      scale: 1.08,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });

    this.enemies.forEach((enemy) => {
      if (!enemy.isAlive) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(
        x,
        y,
        enemy.sprite.x,
        enemy.sprite.y,
      );

      if (distance > shockwave.radius) {
        return;
      }

      const killed = enemy.takeDamage(shockwave.damage);
      enemy.applyKnockback(x, y, shockwave.knockback);

      if (killed) {
        this.kills += 1;
        this.spawnPickup("xp", enemy.xpValue, enemy.sprite.x, enemy.sprite.y);
        this.trySpawnHealthPickup(enemy.sprite.x, enemy.sprite.y);
        this.removeEnemy(enemy);
      }
    });
  }

  openUpgradeSelection() {
    const uiScene = this.scene.get("UIScene");

    if (!uiScene) {
      return;
    }

    this.isChoosingUpgrade = true;
    uiScene.showUpgradeChoices(this.upgradeSystem.getChoices(), this.level);
    this.scene.pause(this.scene.key);
  }

  applyUpgrade(upgradeId) {
    this.upgradeSystem.applyUpgrade(upgradeId);
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    this.score = this.calculateScore();

    const uiScene = this.scene.get("UIScene");

    if (this.pendingLevelUps > 0) {
      uiScene.showUpgradeChoices(this.upgradeSystem.getChoices(), this.level);
      this.isChoosingUpgrade = true;
      return;
    }

    this.isChoosingUpgrade = false;
    uiScene.hideUpgradeChoices();
    this.scene.resume(this.scene.key);
  }

  flashDamage() {
    this.damageFlash.alpha = 0.28;
    this.tweens.killTweensOf(this.damageFlash);
    this.tweens.add({
      targets: this.damageFlash,
      alpha: 0,
      duration: GAME_BALANCE.feedback.hitFlashDuration,
      ease: "Quad.easeOut",
    });
  }

  showFloatingText(x, y, text, color, size = 16) {
    const label = this.add
      .text(x, y, text, {
        fontSize: `${size}px`,
        color,
        stroke: "#050816",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(8);

    this.tweens.add({
      targets: label,
      y: y - 24,
      alpha: 0,
      duration: 650,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  emitBurst(x, y, color, count, radius) {
    for (let index = 0; index < count; index += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.FloatBetween(radius * 0.4, radius * 1.8);
      const particle = this.add.circle(x, y, 2, color).setDepth(2);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(160, 260),
        ease: "Quad.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
  }

  endGame(didWin = false) {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.spawnTimer?.remove(false);
    this.ambientTimer?.remove(false);
    this.scene.stop("UIScene");
    this.scene.start("GameOverScene", {
      didWin,
      score: this.score,
      time: this.survivalTime,
      level: this.level,
      kills: this.kills,
      targetTime: GAME_BALANCE.goal.targetTime,
    });
  }
}
