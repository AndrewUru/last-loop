import Phaser from "phaser";

// Three on-screen buttons for phones and tablets: steer left/right with the
// left thumb, hold IMPULSO with the right thumb.
export default class FlightTouchControls {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.objects = [];
    this.buttons = [];
    this.visible = false;
  }

  create() {
    this.leftButton = this.createButton("◀", 0x8fd7ff);
    this.rightButton = this.createButton("▶", 0x8fd7ff);
    this.thrustButton = this.createButton("IMPULSO", 0xffb26b);

    this.bindHold(this.leftButton, (active) => this.options.onSteerLeft?.(active));
    this.bindHold(this.rightButton, (active) => this.options.onSteerRight?.(active));
    this.bindHold(this.thrustButton, (active) => this.options.onThrust?.(active));

    // A finger can slide off a button before lifting, so releases are matched
    // by pointer id anywhere on screen.
    this.releasePointer = (pointer) => {
      this.buttons.forEach((button) => {
        if (button.pointerId === pointer.id) {
          button.setActive(false);
        }
      });
    };
    this.scene.input.on("pointerup", this.releasePointer);
    this.scene.input.on("pointerupoutside", this.releasePointer);
    this.scene.events.once("shutdown", () => {
      this.scene.input.off("pointerup", this.releasePointer);
      this.scene.input.off("pointerupoutside", this.releasePointer);
    });

    this.resize(this.scene.scale.width, this.scene.scale.height);
  }

  createButton(label, accent) {
    const depth = 54;
    const background = this.scene.add
      .circle(0, 0, 32, 0x0b121a, 0.62)
      .setStrokeStyle(3, accent, 0.9)
      .setScrollFactor(0)
      .setDepth(depth)
      .setInteractive(new Phaser.Geom.Circle(32, 32, 32), Phaser.Geom.Circle.Contains);
    const text = this.scene.add
      .text(0, 0, label, {
        fontSize: "26px",
        color: "#f7fbff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);
    const button = { background, text, accent, active: false, pointerId: null };

    this.buttons.push(button);
    this.objects.push(background, text);
    return button;
  }

  bindHold(button, callback) {
    button.setActive = (active, pointerId = null) => {
      button.pointerId = active ? pointerId : null;
      if (button.active === active) {
        return;
      }
      button.active = active;
      callback(active);
      button.background.setFillStyle(active ? button.accent : 0x0b121a, active ? 0.45 : 0.62);
    };

    button.background.on("pointerdown", (pointer) => button.setActive(true, pointer.id));
  }

  resize(width, height) {
    const touchDevice = Boolean(this.scene.sys.game.device.input.touch);
    this.visible = touchDevice || width < 760;

    const minSide = Math.min(width, height);
    const radius = Math.round(Math.max(34, Math.min(48, minSide * 0.09)));
    const margin = Math.max(18, Math.round(minSide * 0.05));
    const bottom = height - margin - radius;

    this.layoutButton(this.leftButton, margin + radius, bottom, radius, 0.7);
    this.layoutButton(this.rightButton, margin + radius * 3.4, bottom, radius, 0.7);
    this.layoutButton(this.thrustButton, width - margin - radius * 1.3, bottom - radius * 0.3, radius * 1.3, 0.26);

    this.objects.forEach((object) => object.setVisible(this.visible));
  }

  layoutButton(button, x, y, radius, fontScale) {
    button.background.setPosition(x, y).setRadius(radius);
    // Generous hit circle so a thumb slightly off-centre still counts.
    button.background.input.hitArea.setTo(radius, radius, radius * 1.2);
    button.text.setPosition(x, y).setFontSize(`${Math.round(radius * fontScale)}px`);
  }

  update(state) {
    const thrusting = state.engineOn && state.fuelRemaining > 0.01;
    this.thrustButton.text.setAlpha(state.fuelRemaining > 0.01 && !state.result ? 1 : 0.35);
    this.thrustButton.background.setStrokeStyle(3, thrusting ? 0xffe0a8 : 0xffb26b, thrusting ? 1 : 0.9);
  }

  getObjects() {
    return this.objects;
  }
}
