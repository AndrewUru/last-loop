export default class FlightTouchControls {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.objects = [];
    this.buttons = [];
    this.visible = false;
  }

  create() {
    const depth = 50;

    this.leftButton = this.createButton("<", 0x101820, 0x8fd7ff, depth);
    this.rightButton = this.createButton(">", 0x101820, 0x8fd7ff, depth);
    this.throttleUpButton = this.createButton("+", 0x1b231b, 0x73f7c0, depth);
    this.throttleDownButton = this.createButton("-", 0x231b18, 0xffb26b, depth);

    this.bindHold(this.leftButton, (active) => this.options.onSteerLeft?.(active));
    this.bindHold(this.rightButton, (active) => this.options.onSteerRight?.(active));
    this.bindHold(this.throttleUpButton, (active) => this.options.onThrottleUp?.(active));
    this.bindHold(this.throttleDownButton, (active) => this.options.onThrottleDown?.(active));

    this.resize(this.scene.scale.width, this.scene.scale.height);
  }

  createButton(label, fill, accent, depth) {
    const shadow = this.scene.add
      .circle(0, 0, 32, 0x000000, 0.22)
      .setScrollFactor(0)
      .setDepth(depth - 1);
    const background = this.scene.add
      .circle(0, 0, 32, fill, 0.72)
      .setStrokeStyle(2, accent, 0.82)
      .setScrollFactor(0)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add
      .text(0, 0, label, {
        fontSize: "28px",
        color: "#f7fbff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);
    const button = { shadow, background, text, accent };

    this.buttons.push(button);
    this.objects.push(shadow, background, text);
    return button;
  }

  bindHold(button, callback) {
    const setActive = (active) => {
      callback(active);
      button.background.setFillStyle(button.background.fillColor, active ? 0.94 : 0.72);
      button.background.setStrokeStyle(2, button.accent, active ? 1 : 0.82);
      button.text.setAlpha(active ? 1 : 0.88);
    };
    const stop = (pointer, localX, localY, event) => {
      event?.stopPropagation();
    };

    button.background.on("pointerdown", (pointer, localX, localY, event) => {
      stop(pointer, localX, localY, event);
      setActive(true);
    });
    button.background.on("pointerup", (pointer, localX, localY, event) => {
      stop(pointer, localX, localY, event);
      setActive(false);
    });
    button.background.on("pointerout", () => setActive(false));
    button.background.on("pointerupoutside", () => setActive(false));
  }

  resize(width, height) {
    this.visible = width < 920 || height > width * 1.05;

    const minSide = Math.min(width, height);
    const radius = Math.round(Math.max(28, Math.min(40, minSide * 0.085)));
    const margin = Math.max(16, Math.round(minSide * 0.045));
    const bottom = height - margin - radius;
    const gap = Math.max(10, Math.round(radius * 0.38));
    const leftX = margin + radius;
    const rightX = leftX + radius * 2 + gap;
    const throttleX = width - margin - radius;
    const throttleTopY = bottom - radius * 2 - gap;

    this.layoutButton(this.leftButton, leftX, bottom, radius);
    this.layoutButton(this.rightButton, rightX, bottom, radius);
    this.layoutButton(this.throttleUpButton, throttleX, throttleTopY, radius);
    this.layoutButton(this.throttleDownButton, throttleX, bottom, radius);

    this.objects.forEach((object) => object.setVisible(this.visible));
  }

  layoutButton(button, x, y, radius) {
    button.shadow.setPosition(x + 2, y + 3).setRadius(radius);
    button.background.setPosition(x, y).setRadius(radius);
    button.background.input.hitArea.setTo(0, 0, radius);
    button.text.setPosition(x, y - 1).setFontSize(`${Math.round(radius * 0.88)}px`);
  }

  getObjects() {
    return this.objects;
  }
}
