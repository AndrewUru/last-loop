import { FLIGHT_TARGETS, FLIGHT_WORLD } from "../systems/FlightModel.js";
import { FLIGHT_PHASES } from "../systems/FlightPhaseController.js";

export default class FlightHud {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.onEngineToggle = options.onEngineToggle;
    this.helpVisible = false;
    this.objects = [];
  }

  create() {
    const { width } = this.scene.scale;
    const panelDepth = 40;
    const textDepth = 41;
    const helpDepth = 60;
    const helpTextDepth = 61;

    this.leftPanel = this.createPanel(28, 24, 246, 246);
    this.rightPanel = this.createPanel(width - 274, 24, 246, 270);
    this.banner = this.scene.add
      .rectangle(width / 2, 44, 340, 70, 0x091824, 0.94)
      .setStrokeStyle(2, 0x73f7c0, 0.42)
      .setScrollFactor(0)
      .setDepth(panelDepth);
    this.bannerTitle = this.scene.add.text(width / 2, 24, "", {
      fontSize: "22px",
      color: "#effcff",
      fontStyle: "bold",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(textDepth);
    this.bannerBody = this.scene.add.text(width / 2, 52, "", {
      fontSize: "16px",
      color: "#a9dcf5",
      align: "center",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(textDepth);

    this.telemetryText = this.scene.add.text(44, 46, "", {
      fontSize: "18px",
      color: "#d8f7ff",
      lineSpacing: 10,
    }).setScrollFactor(0).setDepth(textDepth);
    this.objectiveText = this.scene.add.text(width - 258, 46, "", {
      fontSize: "17px",
      color: "#d8f7ff",
      lineSpacing: 10,
      wordWrap: { width: 214 },
    }).setScrollFactor(0).setDepth(textDepth);
    this.hintText = this.scene.add.text(44, 278, "H controls", {
      fontSize: "14px",
      color: "#73f7c0",
    }).setScrollFactor(0).setDepth(textDepth);

    this.engineButton = this.scene.add
      .rectangle(151, this.scene.scale.height - 52, 246, 48, 0x183c2d, 0.96)
      .setStrokeStyle(2, 0x73f7c0, 0.65)
      .setScrollFactor(0)
      .setDepth(textDepth)
      .setInteractive({ useHandCursor: true });
    this.engineButtonLabel = this.scene.add.text(151, this.scene.scale.height - 52, "Ignite Engine", {
      fontSize: "18px",
      color: "#effcff",
      fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(textDepth + 1);

    this.helpPanel = this.createPanel(this.scene.scale.width / 2 - 220, this.scene.scale.height - 214, 440, 170, 60);
    this.helpTitle = this.scene.add.text(this.scene.scale.width / 2, this.scene.scale.height - 190, "Controls", {
      fontSize: "20px",
      color: "#effcff",
      fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setVisible(false).setDepth(helpTextDepth);
    this.helpText = this.scene.add.text(
      this.scene.scale.width / 2 - 190,
      this.scene.scale.height - 164,
      [
        "Space/F ignite or shut down",
        "W / S adjust throttle",
        "A / D rotate",
        "Shift full burn",
        "RMB drag pan camera",
        "Wheel zoom",
        "H toggle help",
        "Esc return to hangar",
      ].join("\n"),
      {
        fontSize: "16px",
        color: "#a9dcf5",
        lineSpacing: 7,
      },
    ).setScrollFactor(0).setVisible(false).setDepth(helpTextDepth);

    this.helpPanel.setVisible(false).setDepth(helpDepth);

    this.engineButton.on("pointerdown", () => this.onEngineToggle?.());
    this.engineButton.on("pointerover", () => this.engineButton.setStrokeStyle(2, 0x73f7c0, 1));
    this.engineButton.on("pointerout", () => this.engineButton.setStrokeStyle(2, 0x73f7c0, 0.65));

    this.objects.push(
      this.leftPanel,
      this.rightPanel,
      this.banner,
      this.bannerTitle,
      this.bannerBody,
      this.telemetryText,
      this.objectiveText,
      this.hintText,
      this.engineButton,
      this.engineButtonLabel,
      this.helpPanel,
      this.helpTitle,
      this.helpText,
    );

    this.resize(this.scene.scale.width, this.scene.scale.height);
  }

  createPanel(x, y, width, height, depth = 40) {
    return this.scene.add
      .rectangle(x, y, width, height, 0x06111b, 0.98)
      .setOrigin(0)
      .setStrokeStyle(2, 0x68d9ff, 0.42)
      .setScrollFactor(0)
      .setDepth(depth);
  }

  getObjects() {
    return this.objects;
  }

  resize(width, height) {
    const margin = 28;
    const panelWidth = Math.min(246, Math.max(180, Math.floor(width * 0.22)));
    const leftHeight = 246;
    const rightHeight = 270;
    const bannerWidth = Math.min(340, Math.max(240, Math.floor(width * 0.32)));
    const helpWidth = Math.min(440, Math.max(320, width - 64));

    this.leftPanel.setPosition(margin, 24).setSize(panelWidth, leftHeight);
    this.rightPanel
      .setPosition(width - margin - panelWidth, 24)
      .setSize(panelWidth, rightHeight);

    this.banner.setPosition(width / 2, 44).setSize(bannerWidth, 70);
    this.bannerTitle.setPosition(width / 2, 24);
    this.bannerBody.setPosition(width / 2, 52);

    this.telemetryText.setPosition(margin + 16, 46);
    this.objectiveText.setPosition(width - margin - panelWidth + 16, 46);
    this.objectiveText.setWordWrapWidth(panelWidth - 32);
    this.hintText.setPosition(margin + 16, 278);

    this.engineButton.setPosition(151, height - 52);
    this.engineButtonLabel.setPosition(151, height - 52);

    this.helpPanel
      .setPosition(width / 2 - helpWidth / 2, height - 214)
      .setSize(helpWidth, 170);
    this.helpTitle.setPosition(width / 2, height - 190);
    this.helpText.setPosition(width / 2 - helpWidth / 2 + 30, height - 164);
  }

  getMissionPhase(state) {
    switch (state.phaseId) {
      case FLIGHT_PHASES.LIFTOFF:
      case FLIGHT_PHASES.PAD:
        return {
          title: "LIFTOFF",
          instruction: "Lift off safely",
        };
      case FLIGHT_PHASES.ASCENT:
        return {
          title: "ASCENT",
          instruction: "Gain altitude before turning",
        };
      case FLIGHT_PHASES.GRAVITY_TURN:
        return {
          title: "TURN",
          instruction: "Tilt gradually to build lateral speed",
        };
      case FLIGHT_PHASES.ORBIT_PUSH:
        return {
          title: "ORBIT PUSH",
          instruction: "Raise periapsis to stabilize orbit",
        };
      case FLIGHT_PHASES.ORBIT:
        return {
          title: "ORBIT",
          instruction: "Hold the corridor",
        };
      default:
        return {
          title: "FLIGHT",
          instruction: state.reason || "Keep the ship under control",
        };
    }
  }

  update(state, uiState) {
    const phase = this.getMissionPhase(state);
    const fuelPct =
      uiState.stats.fuel > 0 ? (state.fuelRemaining / uiState.stats.fuel) * 100 : 0;
    const prediction = uiState.predictionSummary || {
      apoapsis: state.apoapsis,
      periapsis: state.periapsis,
    };

    this.bannerTitle.setText(phase.title);
    this.bannerBody.setText(phase.instruction);

    this.telemetryText.setText(
      [
        `ALT   ${state.altitude.toFixed(1)} km`,
        `SPD   ${state.speed.toFixed(2)} km/s`,
        `FUEL  ${Math.max(0, fuelPct).toFixed(0)}%`,
        `THR   ${Math.round(state.throttle * 100)}%`,
        `APO   ${prediction.apoapsis.toFixed(1)} km`,
        `PERI  ${prediction.periapsis.toFixed(1)} km`,
        `PHASE ${state.phase}`,
      ].join("\n"),
    );

    this.objectiveText.setText(
      [
        "OBJECTIVE",
        "Reach stable orbit",
        "",
        "TARGET",
        `Apoapsis: ${FLIGHT_WORLD.targetOrbitAltitude} km`,
        `Orbit speed: ${FLIGHT_TARGETS.orbitalVelocity.toFixed(2)} km/s`,
        `Lock: ${state.orbitHoldTime.toFixed(1)} / ${FLIGHT_WORLD.orbitLockDuration}s`,
        "",
        "CHECKLIST",
        `${state.launched ? "[x]" : "[ ]"} Liftoff`,
        `${state.altitude >= FLIGHT_WORLD.atmosphereHeight ? "[x]" : "[ ]"} Clear atmosphere`,
        `${Math.abs(state.horizontalVelocity) >= FLIGHT_TARGETS.orbitalVelocity * 0.72 ? "[x]" : "[ ]"} Build lateral speed`,
        `${state.orbitHoldTime > 0.08 ? "[x]" : "[ ]"} Stabilize orbit`,
      ].join("\n"),
    );

    if (state.engineOn) {
      this.engineButton.setFillStyle(0x5b1f1f, 0.96).setStrokeStyle(2, 0xff9b7a, 0.7);
      this.engineButtonLabel.setText("Shutdown Engine");
    } else {
      this.engineButton.setFillStyle(0x183c2d, 0.96).setStrokeStyle(2, 0x73f7c0, 0.7);
      this.engineButtonLabel.setText("Ignite Engine");
    }
  }

  toggleHelp() {
    this.helpVisible = !this.helpVisible;
    this.helpPanel.setVisible(this.helpVisible);
    this.helpTitle.setVisible(this.helpVisible);
    this.helpText.setVisible(this.helpVisible);
    this.hintText.setText(this.helpVisible ? "H hide controls" : "H controls");
  }
}
