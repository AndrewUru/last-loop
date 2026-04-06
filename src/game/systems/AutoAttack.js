import Phaser from "phaser";

export default class AutoAttack {
  constructor(scene) {
    this.scene = scene;
  }

  update(time) {
    const player = this.scene.player;
    if (
      !player ||
      !player.isAlive() ||
      this.scene.isChoosingUpgrade ||
      !player.canShoot(time)
    ) {
      return;
    }

    const target = this.findNearestEnemy(player.attackRange);
    if (!target) {
      return;
    }

    player.markShot(time);
    this.fireBurst(target);
  }

  fireBurst(target) {
    const player = this.scene.player;
    const baseAngle = Phaser.Math.Angle.Between(
      player.sprite.x,
      player.sprite.y,
      target.sprite.x,
      target.sprite.y,
    );
    const count = player.projectileCount;

    if (count === 1) {
      this.scene.spawnBullet(baseAngle);
      return;
    }

    const startAngle = baseAngle - (player.projectileSpread * (count - 1)) / 2;

    for (let index = 0; index < count; index += 1) {
      this.scene.spawnBullet(startAngle + player.projectileSpread * index);
    }
  }

  findNearestEnemy(range) {
    let nearest = null;
    let nearestDistance = Number.MAX_VALUE;

    this.scene.enemies.forEach((enemy) => {
      if (!enemy.isAlive) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(
        this.scene.player.sprite.x,
        this.scene.player.sprite.y,
        enemy.sprite.x,
        enemy.sprite.y,
      );

      if (distance <= range && distance < nearestDistance) {
        nearestDistance = distance;
        nearest = enemy;
      }
    });

    return nearest;
  }
}
