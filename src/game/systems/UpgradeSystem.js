import Phaser from "phaser";

export default class UpgradeSystem {
  constructor(scene) {
    this.scene = scene;
    this.upgrades = [
      {
        id: "damage",
        title: "Core Overclock",
        description: "+10% damage",
        apply: () => {
          this.scene.player.damage = Number(
            (this.scene.player.damage * 1.1).toFixed(1),
          );
        },
      },
      {
        id: "fireRate",
        title: "Rapid Chamber",
        description: "+10% fire rate",
        apply: () => {
          this.scene.player.fireRate = Math.max(
            180,
            Math.round(this.scene.player.fireRate * 0.9),
          );
        },
      },
      {
        id: "speed",
        title: "Blink Thrusters",
        description: "+12% movement speed",
        apply: () => {
          this.scene.player.moveSpeed = Math.round(
            this.scene.player.moveSpeed * 1.12,
          );
        },
      },
      {
        id: "health",
        title: "Hull Plating",
        description: "+20 max health",
        apply: () => {
          this.scene.player.addMaxHealth(20);
        },
      },
      {
        id: "projectile",
        title: "Split Fire",
        description: "+1 projectile per attack",
        isAvailable: () => this.scene.player.projectileCount < 5,
        apply: () => {
          this.scene.player.projectileCount += 1;
        },
      },
      {
        id: "iframes",
        title: "Phase Skin",
        description: "+20% invulnerability after hit",
        apply: () => {
          this.scene.player.invulnerabilityDuration = Math.round(
            this.scene.player.invulnerabilityDuration * 1.2,
          );
        },
      },
      {
        id: "magnet",
        title: "Scrap Magnet",
        description: "XP and heal pickups pull from farther away",
        apply: () => {
          this.scene.player.pickupRangeMultiplier = Number(
            (this.scene.player.pickupRangeMultiplier * 1.3).toFixed(2),
          );
          this.scene.player.pickupSpeedMultiplier = Number(
            (this.scene.player.pickupSpeedMultiplier * 1.18).toFixed(2),
          );
        },
      },
    ];
  }

  getChoices(count = 3) {
    const available = this.upgrades.filter(
      (upgrade) => !upgrade.isAvailable || upgrade.isAvailable(),
    );
    const shuffled = Phaser.Utils.Array.Shuffle([...available]);

    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  applyUpgrade(id) {
    const upgrade = this.upgrades.find((candidate) => candidate.id === id);

    if (!upgrade) {
      return;
    }

    upgrade.apply();
  }
}
