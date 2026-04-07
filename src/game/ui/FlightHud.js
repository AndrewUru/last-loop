import Phaser from "phaser";
import { FLIGHT_TARGETS, FLIGHT_WORLD } from "../systems/FlightSimulator.js";

export default class FlightHud {
  constructor(scene, { onEngineToggle }) {
    this.scene = scene;
    this.onEngineToggle = onEngineToggle;
    this.objects = [];
    this.missionPhaseId = null;
  }

  create() {
    this.leftHudShadow = this.scene.add
      .rectangle(0, 0, 316, 306, 0x000000, 0.3)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68d9ff, 0.1)
      .setDepth(39);

    this.leftHud = this.scene.add
      .rectangle(0, 0, 316, 306, 0x081624, 0.95)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68d9ff, 0.35)
      .setDepth(40);
    this.telemetryTitle = this.scene.add
      .text(0, 0, "Orbital Telemetry", {
        fontSize: "30px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(41);
    this.controlsHint = this.scene.add
      .text(
        0,
        0,
        [
          "Keyboard Flight Controls",
          "[F/Space] Begin launch  [Shift] Full burn",
          "[A/D or arrows] Steer  [W/S or arrows] Cruise",
          "[Wheel or Q/E] Zoom  [R] Reset view  [Esc] Return",
          "Mouse stays UI-only during flight",
        ].join("\n"),
        {
          fontSize: "14px",
          color: "#8fd7ff",
          lineSpacing: 4,
          wordWrap: { width: 280 },
        },
      )
      .setScrollFactor(0)
      .setDepth(41);
    this.metricsText = this.scene.add
      .text(0, 0, "", {
        fontSize: "17px",
        color: "#d8f7ff",
        lineSpacing: 9,
      })
      .setScrollFactor(0)
      .setDepth(41);

    this.rightHudShadow = this.scene.add
      .rectangle(0, 0, 316, 306, 0x000000, 0.3)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68d9ff, 0.1)
      .setDepth(39);

    this.rightHud = this.scene.add
      .rectangle(0, 0, 316, 306, 0x081624, 0.95)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68d9ff, 0.35)
      .setDepth(40);
    this.progressText = this.scene.add
      .text(0, 0, "", {
        fontSize: "17px",
        color: "#d8f7ff",
        lineSpacing: 9,
        wordWrap: { width: 280 },
      })
      .setScrollFactor(0)
      .setDepth(41);

    this.phaseBannerShadow = this.scene.add
      .rectangle(0, 0, 420, 88, 0x000000, 0.22)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x73f7c0, 0.08)
      .setDepth(40);
    this.phaseBanner = this.scene.add
      .rectangle(0, 0, 420, 88, 0x091824, 0.94)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x73f7c0, 0.4)
      .setDepth(41);
    this.phaseBannerTitle = this.scene.add
      .text(0, 0, "", {
        fontSize: "22px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(42);
    this.phaseBannerBody = this.scene.add
      .text(0, 0, "", {
        fontSize: "15px",
        color: "#a9dcf5",
        align: "center",
        wordWrap: { width: 360 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(42);

    this.countdownBadgeShadow = this.scene.add
      .rectangle(0, 0, 144, 58, 0x000000, 0.22)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0xffd773, 0.08)
      .setDepth(42);
    this.countdownBadge = this.scene.add
      .rectangle(0, 0, 144, 58, 0x231707, 0.94)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0xffd773, 0.55)
      .setDepth(43);
    this.countdownText = this.scene.add
      .text(0, 0, "", {
        fontSize: "28px",
        color: "#fff2bf",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(44);

    this.engineButtonShadow = this.scene.add
      .rectangle(0, 0, 240, 52, 0x000000, 0.25)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x73f7c0, 0.1)
      .setDepth(41)
      .setInteractive({ useHandCursor: true });

    this.engineButton = this.scene.add
      .rectangle(0, 0, 240, 52, 0x163248, 0.96)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x73f7c0, 0.6)
      .setDepth(42)
      .setInteractive({ useHandCursor: true });
    this.engineButtonLabel = this.scene.add
      .text(0, 0, "Begin Launch", {
        fontSize: "20px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(43);

    this.objects.push(
      this.leftHudShadow,
      this.leftHud,
      this.telemetryTitle,
      this.controlsHint,
      this.metricsText,
      this.rightHudShadow,
      this.rightHud,
      this.progressText,
      this.phaseBannerShadow,
      this.phaseBanner,
      this.phaseBannerTitle,
      this.phaseBannerBody,
      this.countdownBadgeShadow,
      this.countdownBadge,
      this.countdownText,
      this.engineButtonShadow,
      this.engineButton,
      this.engineButtonLabel,
    );

    this.engineButton.on("pointerdown", () => {
      this.onEngineToggle?.();
    });
    this.engineButton.on("pointerover", () => {
      this.engineButton.setStrokeStyle(2, 0x73f7c0, 1);
    });
    this.engineButton.on("pointerout", () => {
      this.engineButton.setStrokeStyle(2, 0x73f7c0, 0.7);
    });
  }

  getObjects() {
    return this.objects;
  }

  layout(width = this.scene.scale.width, height = this.scene.scale.height) {
    const panelWidth = Phaser.Math.Clamp(Math.round(width * 0.21), 250, 316);
    const panelHeight = Phaser.Math.Clamp(Math.round(height * 0.36), 230, 306);
    const sideMargin = Phaser.Math.Clamp(Math.round(width * 0.025), 22, 42);
    const topMargin = Phaser.Math.Clamp(Math.round(height * 0.05), 28, 44);
    const leftX = sideMargin + panelWidth / 2;
    const rightX = width - sideMargin - panelWidth / 2;
    const panelTop = topMargin;
    const panelCenterY = panelTop + panelHeight / 2;
    const innerLeft = leftX - panelWidth / 2 + 16;
    const innerRight = rightX - panelWidth / 2 + 16;
    const centerX = width / 2;
    const buttonWidth = Phaser.Math.Clamp(Math.round(panelWidth * 0.76), 188, 240);
    const buttonHeight = 52;
    const buttonX = leftX;
    const buttonY = Math.min(
      height - topMargin - buttonHeight / 2,
      panelTop + panelHeight + buttonHeight / 2 + 18,
    );

    this.leftHudShadow.setPosition(leftX + 2, panelCenterY + 2);
    this.leftHudShadow.setSize(panelWidth, panelHeight);
    this.leftHud.setPosition(leftX, panelCenterY);
    this.leftHud.setSize(panelWidth, panelHeight);

    this.telemetryTitle.setPosition(innerLeft, panelTop + 12);
    this.controlsHint.setPosition(innerLeft, panelTop + 48);
    this.controlsHint.setWordWrapWidth(panelWidth - 32);
    this.metricsText.setPosition(
      innerLeft,
      this.controlsHint.y + this.controlsHint.height + 14,
    );

    this.rightHudShadow.setPosition(rightX + 2, panelCenterY + 2);
    this.rightHudShadow.setSize(panelWidth, panelHeight);
    this.rightHud.setPosition(rightX, panelCenterY);
    this.rightHud.setSize(panelWidth, panelHeight);
    this.progressText.setPosition(innerRight, panelTop + 12);
    this.progressText.setWordWrapWidth(panelWidth - 32);

    const bannerWidth = Phaser.Math.Clamp(
      Math.round(width * 0.3),
      320,
      width - sideMargin * 2 - panelWidth * 2 + 40,
    );
    const clampedBannerWidth = Math.max(280, bannerWidth);
    this.phaseBannerShadow.setPosition(centerX + 2, panelTop + 42);
    this.phaseBannerShadow.setSize(clampedBannerWidth, 88);
    this.phaseBanner.setPosition(centerX, panelTop + 40);
    this.phaseBanner.setSize(clampedBannerWidth, 88);
    this.phaseBannerTitle.setPosition(centerX, panelTop + 16);
    this.phaseBannerBody.setPosition(centerX, panelTop + 32);
    this.phaseBannerBody.setWordWrapWidth(clampedBannerWidth - 44);

    this.countdownBadgeShadow.setPosition(centerX + 2, panelTop + 112);
    this.countdownBadge.setPosition(centerX, panelTop + 110);
    this.countdownText.setPosition(centerX, panelTop + 110);

    this.engineButtonShadow.setPosition(buttonX + 2, buttonY + 2);
    this.engineButtonShadow.setSize(buttonWidth, buttonHeight);
    this.engineButton.setPosition(buttonX, buttonY);
    this.engineButton.setSize(buttonWidth, buttonHeight);
    this.engineButtonLabel.setPosition(buttonX, buttonY);
  }

  update(state, uiState) {
    const missionPhase = this.getMissionPhase(state);
    const zoomBiasPct = Math.round(
      (uiState.manualZoomOffset / uiState.zoomSettings.step) * 6,
    );
    const prediction = uiState.predictionSummary || {
      apoapsis: state.apoapsis,
      periapsis: state.periapsis,
    };

    this.updateMissionPhase(state, uiState, missionPhase);

    const fuelPct =
      uiState.stats.fuel > 0 ? (state.fuelRemaining / uiState.stats.fuel) * 100 : 0;
    this.metricsText.setText(
      [
        `Phase: ${state.phase}`,
        `Engine: ${state.engineOn ? "ON" : "OFF"}`,
        `Altitude: ${state.altitude.toFixed(1)} km`,
        `Speed: ${state.speed.toFixed(2)} km/s`,
        `Radial vel: ${state.radialVelocity.toFixed(2)} km/s`,
        `Tangential vel: ${Math.abs(state.tangentialVelocity).toFixed(2)} km/s`,
        `Throttle: ${Math.round(state.throttle * 100)}%`,
        `Fuel: ${Math.max(0, fuelPct).toFixed(0)}%`,
        `G-load: ${state.currentG.toFixed(1)} g`,
        `Pred apoapsis: ${prediction.apoapsis.toFixed(1)} km`,
        `Pred periapsis: ${prediction.periapsis.toFixed(1)} km`,
        `Mission step: ${missionPhase.index}/${missionPhase.total}`,
        `View zoom: ${uiState.cameraZoom.toFixed(2)}x`,
        `Zoom trim: ${zoomBiasPct >= 0 ? "+" : ""}${zoomBiasPct}%`,
      ].join("\n"),
    );

    this.progressText.setText(
      [
        "Primary Objective",
        "Place the ship into a stable orbit around Earth.",
        "",
        `${missionPhase.label}`,
        missionPhase.message,
        "Guide: cyan dots show your projected path, green band is the orbit corridor.",
        "",
        `Orbit altitude: ${FLIGHT_WORLD.targetOrbitAltitude} km`,
        `Target orbital speed: ${FLIGHT_TARGETS.orbitalVelocity.toFixed(2)} km/s`,
        `Orbit lock: ${state.orbitHoldTime.toFixed(1)} / ${FLIGHT_WORLD.orbitLockDuration}s`,
        `Apoapsis: ${state.apoapsis.toFixed(1)} km`,
        `Periapsis: ${state.periapsis.toFixed(1)} km`,
        `Pilot input: ${uiState.controlsSource}`,
        `Checklist: ${this.buildMissionChecklist(state)}`,
        state.reason
          ? `Status: ${state.reason}`
          : uiState.countdown.active
            ? "Status: countdown active, ignition will start automatically."
            : state.engineOn
              ? `Status: ${missionPhase.status}`
              : "Status: begin the launch sequence to leave the pad.",
      ].join("\n"),
    );

    this.updateCountdown(uiState.countdown);
    this.updateEngineButton(state, uiState.countdown);
  }

  updateCountdown(countdown) {
    const visible = countdown.active;
    this.countdownBadgeShadow.setVisible(visible);
    this.countdownBadge.setVisible(visible);
    this.countdownText.setVisible(visible);

    if (!visible) {
      return;
    }

    const count = Math.max(1, Math.ceil(countdown.remaining));
    this.countdownText.setText(`T-${count}`);
  }

  getMissionPhase(state) {
    const total = 5;

    if (state.orbitAchieved || state.result === "success" || state.orbitHoldTime > 0.5) {
      return {
        id: "hold-orbit",
        index: 5,
        total,
        label: "Phase 5: Hold Orbit",
        title: "Phase 5/5: Hold Orbit",
        message:
          "Stay close to target altitude and keep radial speed low until orbit lock completes.",
        status: "Hold a clean orbit until the lock timer completes.",
      };
    }

    if (!state.launched || state.altitude < 12) {
      return {
        id: "launch",
        index: 1,
        total,
        label: "Phase 1: Launch",
        title: "Phase 1/5: Launch",
        message:
          "Ignite the engine and lift off cleanly. Keep the stack steady while leaving the pad.",
        status: "Climb straight and avoid over-correcting.",
      };
    }

    if (state.altitude < FLIGHT_WORLD.atmosphereHeight * 0.55) {
      return {
        id: "ascent",
        index: 2,
        total,
        label: "Phase 2: Atmospheric Ascent",
        title: "Phase 2/5: Atmospheric Ascent",
        message:
          "Build altitude first. Stay mostly vertical while the atmosphere is still dense.",
        status: "Keep rising and save aggressive turning for later.",
      };
    }

    if (state.altitude < FLIGHT_WORLD.atmosphereHeight + 35) {
      return {
        id: "gravity-turn",
        index: 3,
        total,
        label: "Phase 3: Gravity Turn",
        title: "Phase 3/5: Gravity Turn",
        message:
          "Start a gentle pitch to the side so the rocket trades vertical climb for horizontal speed.",
        status: "Turn gradually and keep the rocket under control.",
      };
    }

    return {
      id: "circularize",
      index: 4,
      total,
      label: "Phase 4: Circularize",
      title: "Phase 4/5: Circularize",
      message:
        "Match the target orbital corridor by building sideways speed near the target altitude.",
      status: "Trim altitude and chase orbital velocity, not raw height.",
    };
  }

  buildMissionChecklist(state) {
    const checks = [
      `${state.launched ? "[x]" : "[ ]"} liftoff`,
      `${state.altitude >= FLIGHT_WORLD.atmosphereHeight ? "[x]" : "[ ]"} clear atmosphere`,
      `${Math.abs(state.tangentialVelocity) >= FLIGHT_TARGETS.orbitalVelocity * 0.75 ? "[x]" : "[ ]"} build lateral speed`,
      `${state.orbitHoldTime > 0.5 ? "[x]" : "[ ]"} stabilize orbit`,
    ];
    return checks.join(" ");
  }

  updateMissionPhase(state, uiState, missionPhase) {
    const bannerId = uiState.countdown.active
      ? `countdown-${Math.ceil(uiState.countdown.remaining)}`
      : missionPhase.id;

    if (bannerId === this.missionPhaseId) {
      return;
    }

    this.missionPhaseId = bannerId;
    if (uiState.countdown.active) {
      this.phaseBannerTitle.setText("Launch Countdown");
      this.phaseBannerBody.setText(
        "Ignition sequence armed. Press the launch button again to abort.",
      );
    } else {
      this.phaseBannerTitle.setText(missionPhase.title);
      this.phaseBannerBody.setText(missionPhase.message);
    }

    this.scene.tweens.killTweensOf([
      this.phaseBannerShadow,
      this.phaseBanner,
      this.phaseBannerTitle,
      this.phaseBannerBody,
    ]);

    [
      this.phaseBannerShadow,
      this.phaseBanner,
      this.phaseBannerTitle,
      this.phaseBannerBody,
    ].forEach((object) => {
      object.setAlpha(0.3);
    });

    this.scene.tweens.add({
      targets: [
        this.phaseBannerShadow,
        this.phaseBanner,
        this.phaseBannerTitle,
        this.phaseBannerBody,
      ],
      alpha: 1,
      duration: 260,
      ease: "Quad.easeOut",
    });
  }

  updateEngineButton(state, countdown) {
    let fillColor = 0x163248;
    let strokeColor = 0x73f7c0;
    let label = "Begin Launch";

    if (countdown.active) {
      fillColor = 0x45260f;
      strokeColor = 0xffd773;
      label = "Abort Countdown";
    } else if (state.engineOn) {
      fillColor = 0x5b1f1f;
      strokeColor = 0xff9b7a;
      label = "Shutdown Engine";
    }

    this.engineButton.setFillStyle(fillColor, 0.96);
    this.engineButton.setStrokeStyle(2, strokeColor, 0.7);
    this.engineButtonLabel.setText(label);
  }
}
