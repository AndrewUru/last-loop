export default class Bullet {
  constructor(scene, x, y, angle, damage, speed, lifetime) {
    this.scene = scene;
    this.damage = damage;
    this.isAlive = true;
    this.expiresAt = scene.time.now + lifetime;

    this.sprite = scene.add.circle(x, y, 4, 0xaefcff).setDepth(1);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCircle(4);
    this.sprite.body.setCircle(4, -4, -4);
    this.sprite.entity = this;
    this.sprite.body.setAllowGravity(false);

    scene.physics.velocityFromRotation(angle, speed, this.sprite.body.velocity);
    this.sprite.rotation = angle;
  }

  update(time) {
    if (!this.isAlive || !this.sprite.active) {
      return false;
    }

    const { x, y } = this.sprite;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    return !(
      time >= this.expiresAt ||
      x < -32 ||
      x > width + 32 ||
      y < -32 ||
      y > height + 32
    );
  }

  destroy() {
    if (!this.isAlive) {
      return;
    }
    this.isAlive = false;
    if (this.sprite && this.sprite.active) {
      this.sprite.destroy();
    }
  }
}
