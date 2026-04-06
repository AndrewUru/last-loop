import Phaser from "phaser";
import Enemy from "../entities/Enemy.js";
import { GAME_BALANCE } from "../data/balance.js";

export default class Spawner {
  constructor(scene) {
    this.scene = scene;
  }

  spawnEnemy(type) {
    const edge = Phaser.Math.Between(0, 3);
    const padding = GAME_BALANCE.spawn.padding;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    let x = 0;
    let y = 0;

    if (edge === 0) {
      x = Phaser.Math.Between(padding, width - padding);
      y = -padding;
    } else if (edge === 1) {
      x = Phaser.Math.Between(padding, width - padding);
      y = height + padding;
    } else if (edge === 2) {
      x = -padding;
      y = Phaser.Math.Between(padding, height - padding);
    } else {
      x = width + padding;
      y = Phaser.Math.Between(padding, height - padding);
    }

    return new Enemy(this.scene, x, y, type);
  }
}
