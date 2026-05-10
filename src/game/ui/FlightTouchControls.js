function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatSigned(value) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(0)}`;
}

export default class FlightTouchControls {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.objects = [];
    this.buttons = [];
    this.visible = false;
    this.layout = {
      throttleTrackHeight: 180,
      throttleTrackY: 0,
    };
  }

  create() {
    const panelDepth = 50;
    const textDepth = 51;
    const controlDepth = 54;

    this.topPanel = this.scene.add
      .rectangle(0, 0, 320, 92, 0x07111a, 0.58)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, 0x9fd7ff, 0.22)
      .setScrollFactor(0)
      .setDepth(panelDepth);
    this.altitudeText = this.createHudText("ALT 0 km", 15, textDepth);
    this.speedText = this.createHudText("VEL 0.00 km/s", 15, textDepth);
    this.apoapsisText = this.createHudText("AP 0", 12, textDepth);
    this.periapsisText = this.createHudText("PE 0", 12, textDepth);
    this.orbitHintText = this.createHudText("Target orbit", 11, textDepth);

    this.throttleTrack = this.scene.add
      .rectangle(0, 0, 12, 180, 0x07111a, 0.68)
      .setOrigin(0.5, 1)
      .setStrokeStyle(1, 0xb7c8d6, 0.3)
      .setScrollFactor(0)
      .setDepth(panelDepth);
    this.throttleFill = this.scene.add
      .rectangle(0, 0, 12, 0, 0x73f7c0, 0.9)
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(panelDepth + 1);
    this.throttleText = this.createHudText("0%", 13, textDepth);
    this.fuelText = this.createHudText("FUEL 100%", 11, textDepth);

    this.throttleUpButton = this.createButton("+", 0x18241f, 0x73f7c0, controlDepth);
    this.throttleDownButton = this.createButton("-", 0x241b18, 0xffb26b, controlDepth);
    this.leftButton = this.createButton("<", 0x101820, 0x8fd7ff, controlDepth);
    this.rightButton = this.createButton(">", 0x101820, 0x8fd7ff, controlDepth);
    this.assistButton = this.createButton("SAS", 0x162335, 0x9fd7ff, controlDepth);
    this.stageButton = this.createButton("STG", 0x2a1d1a, 0xffb26b, controlDepth);

    this.bindHold(this.leftButton, (active) => this.options.onSteerLeft?.(active));
    this.bindHold(this.rightButton, (active) => this.options.onSteerRight?.(active));
    this.bindHold(this.throttleUpButton, (active) => this.options.onThrottleUp?.(active));
    this.bindHold(this.throttleDownButton, (active) => this.options.onThrottleDown?.(active));
    this.bindTap(this.assistButton, () => this.options.onAssistToggle?.());
    this.bindTap(this.stageButton, () => this.options.onStageActivate?.());

    this.objects.push(
      this.topPanel,
      this.altitudeText,
      this.speedText,
      this.apoapsisText,
      this.periapsisText,
      this.orbitHintText,
      this.throttleTrack,
      this.throttleFill,
      this.throttleText,
      this.fuelText,
    );

    this.resize(this.scene.scale.width, this.scene.scale.height);
  }

  createHudText(text, size, depth) {
    return this.scene.add
      .text(0, 0, text, {
        fontSize: `${size}px`,
        color: "#f7fbff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth);
  }

  createButton(label, fill, accent, depth) {
    const shadow = this.scene.add
      .circle(0, 0, 32, 0x000000, 0.22)
      .setScrollFactor(0)
      .setDepth(depth - 1);
    const background = this.scene.add
      .circle(0, 0, 32, fill, 0.74)
      .setStrokeStyle(2, accent, 0.86)
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
      button.background.setFillStyle(button.background.fillColor, active ? 0.96 : 0.74);
      button.background.setStrokeStyle(2, button.accent, active ? 1 : 0.86);
      button.text.setAlpha(active ? 1 : 0.9);
    };
    const stop = (event) => {
      event?.stopPropagation();
    };

    button.background.on("pointerdown", (pointer, localX, localY, event) => {
      stop(event);
      setActive(true);
    });
    button.background.on("pointerup", (pointer, localX, localY, event) => {
      stop(event);
      setActive(false);
    });
    button.background.on("pointerout", () => setActive(false));
    button.background.on("pointerupoutside", () => setActive(false));
  }

  bindTap(button, callback) {
    button.background.on("pointerdown", (pointer, localX, localY, event) => {
      event?.stopPropagation();
      callback();
      this.scene.tweens.add({
        targets: [button.background, button.text],
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 80,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    });
  }

  resize(width, height) {
    this.visible = width < 920 || height > width * 1.05;

    const minSide = Math.min(width, height);
    const radius = Math.round(Math.max(28, Math.min(38, minSide * 0.078)));
    const margin = Math.max(14, Math.round(minSide * 0.04));
    const topSafe = margin;
    const topWidth = Math.min(width - margin * 2, Math.max(280, width * 0.72));
    const topHeight = Math.max(76, Math.min(92, height * 0.13));
    const throttleX = margin + radius;
    const bottom = height - margin - radius;
    const trackHeight = Math.max(132, Math.min(210, height * 0.28));
    const trackBottom = bottom - radius * 1.65;
    const steerRightX = width - margin - radius;
    const steerLeftX = steerRightX - radius * 2.25;
    const actionY = bottom - radius * 2.35;

    this.layout.throttleTrackHeight = trackHeight;
    this.layout.throttleTrackY = trackBottom;

    this.topPanel.setPosition(width / 2, topSafe).setSize(topWidth, topHeight);
    this.altitudeText.setPosition(width / 2, topSafe + 18).setFontSize("15px");
    this.speedText.setPosition(width / 2, topSafe + 38).setFontSize("15px");
    this.apoapsisText.setPosition(width / 2 - topWidth * 0.22, topSafe + topHeight - 18);
    this.periapsisText.setPosition(width / 2 + topWidth * 0.22, topSafe + topHeight - 18);
    this.orbitHintText.setPosition(width / 2, topSafe + topHeight - 18);

    this.throttleTrack.setPosition(throttleX, trackBottom).setSize(12, trackHeight);
    this.throttleFill.setPosition(throttleX, trackBottom).setSize(12, 0);
    this.throttleText.setPosition(throttleX, trackBottom - trackHeight - 18);
    this.fuelText.setPosition(throttleX, trackBottom + 18);

    this.layoutButton(this.throttleUpButton, throttleX, trackBottom - trackHeight - radius - 12, radius);
    this.layoutButton(this.throttleDownButton, throttleX, bottom, radius);
    this.layoutButton(this.leftButton, steerLeftX, bottom, radius);
    this.layoutButton(this.rightButton, steerRightX, bottom, radius);
    this.layoutButton(this.assistButton, steerLeftX, actionY, radius * 0.72);
    this.layoutButton(this.stageButton, steerRightX, actionY, radius * 0.72);

    this.objects.forEach((object) => object.setVisible(this.visible));
  }

  layoutButton(button, x, y, radius) {
    button.shadow.setPosition(x + 2, y + 3).setRadius(radius);
    button.background.setPosition(x, y).setRadius(radius);
    button.background.input.hitArea.setTo(0, 0, radius);
    const fontScale = button.text.text.length > 1 ? 0.45 : 0.9;
    button.text.setPosition(x, y - 1).setFontSize(`${Math.round(radius * fontScale)}px`);
  }

  update(state, uiState = {}) {
    const prediction = uiState.predictionSummary || state;
    const targetAltitude = uiState.targetAltitude ?? 0;
    const fuelPct =
      uiState.stats?.fuel > 0 ? clamp(state.fuelRemaining / uiState.stats.fuel, 0, 1) : 0;
    const throttlePct = clamp(state.throttle, 0, 1);
    const apoDelta = prediction.apoapsis - targetAltitude;
    const periDelta = prediction.periapsis - targetAltitude;

    this.altitudeText.setText(`ALT ${state.altitude.toFixed(1)} km`);
    this.speedText.setText(`VEL ${state.speed.toFixed(2)} km/s`);
    this.apoapsisText.setText(`AP ${prediction.apoapsis.toFixed(0)} (${formatSigned(apoDelta)})`);
    this.periapsisText.setText(`PE ${prediction.periapsis.toFixed(0)} (${formatSigned(periDelta)})`);
    this.orbitHintText.setText(`TARGET ${targetAltitude} km`);
    this.throttleText.setText(`${Math.round(throttlePct * 100)}%`);
    this.fuelText.setText(`FUEL ${Math.round(fuelPct * 100)}%`);
    this.throttleFill.height = this.layout.throttleTrackHeight * throttlePct;
    this.assistButton.background.setStrokeStyle(
      2,
      state.assistEnabled ? 0x73f7c0 : this.assistButton.accent,
      state.assistEnabled ? 1 : 0.86,
    );
  }

  getObjects() {
    return this.objects;
  }
}
