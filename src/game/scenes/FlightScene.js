import Phaser from "phaser";
import ShipPart from "../entities/ShipPart.js";
import { PARTS_BY_ID } from "../data/parts.js";
import ShipStatsCalculator from "../systems/ShipStatsCalculator.js";
import TutorialSystem from "../systems/TutorialSystem.js";
import FlightHud from "../ui/FlightHud.js";
import FlightTouchControls from "../ui/FlightTouchControls.js";
import { ROCKET_CELL_SIZE } from "./flight/FlightSceneConstants.js";
import {
  flightSceneEnvironmentMethods,
} from "./flight/FlightSceneEnvironment.js";
import { flightSceneOverlayMethods } from "./flight/FlightSceneOverlay.js";
import { flightSceneRuntimeMethods } from "./flight/FlightSceneRuntime.js";
import { createFlightRuntimeState } from "./flight/FlightSceneState.js";
import { getBuildCenter } from "./flight/FlightSceneUtils.js";

class FlightScene extends Phaser.Scene {
  constructor() {
    super({ key: "FlightScene" });
  }

  init(data) {
    this.build = data.build || this.registry.get("rocket-build") || [];
    this.stats = data.stats || ShipStatsCalculator.calculate(this.build);
    this.audio = this.registry.get("audio");
    this.audio?.resume();
  }

  create() {
    this.initializeState();
    this.initializeStages();
    this.createBackdrop();
    this.createWorld();
    this.createRocket();
    this.createHud();
    this.createMissionOverlay();
    this.createBackdropCamera();
    this.createUiCamera();
    this.registerInput();
    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.handleResize({ width: this.scale.width, height: this.scale.height });
    this.createFlightTutorial();
  }

  createFlightTutorial() {
    const { width, height } = this.scale;
    this.flightTutorial = new TutorialSystem(this, [
      {
        title: "Flight Controls",
        body: "SPACE/F: Engine on/off. A/D or arrows: Steer. G: Stability assist (SAS). Shift: Full throttle.",
        panelY: height - 180,
        waitForKey: true
      },
      {
        title: "Throttle Control",
        body: "Use 0-4 keys for throttle presets (0%, 35%, 65%, 85%, 100%). Up/Down arrows adjust throttle.",
        panelY: height - 180,
        waitForKey: true
      },
      {
        title: "Reach Orbit",
        body: "Climb vertically, then gradually turn horizontal. Watch the HUD for altitude and speed. Press X to stage if you have decouplers.",
        panelY: height - 180,
        waitForKey: true
      }
    ]);
    this.flightTutorial.start();
  }

  initializeStages() {
    this.stages = [];
    let currentStageParts = [];
    let hasDecoupler = false;

    const sortedBuild = [...this.build].sort((a, b) => b.cellY - a.cellY);
    for (const part of sortedBuild) {
      const def = PARTS_BY_ID[part.partId];
      if (!def) continue;

      if (def.type === "decoupler") {
        if (currentStageParts.length > 0) {
          this.stages.push({ parts: [...currentStageParts] });
          currentStageParts = [];
        }
        hasDecoupler = true;
      } else {
        currentStageParts.push(part);
      }
    }
    if (currentStageParts.length > 0) {
      this.stages.push({ parts: [...currentStageParts] });
    }
    if (this.stages.length > 1 && this.hud) {
      this.hud.updateStageIndicator(this.stages.length - 1);
    }
  }

  initializeState() {
    Object.assign(this, createFlightRuntimeState(this.input, this.stats));
    this.onToggleHelp = () => this.hud.toggleHelp();
    this.onResultRebuild = () => {
      if (this.finished) {
        this.returnToBuild();
      }
    };
    this.onResultRelaunch = () => {
      if (this.finished) {
        this.handleResultPrimaryAction();
      }
    };
    this.onEscapeToBuild = () => {
      this.scene.start("BuildScene", { build: this.build });
    };
  }

  createRocket() {
    const bounds = this.stats.bounds || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const center = getBuildCenter(bounds);

    this.rocket = this.add.container(0, 0).setDepth(20);
    this.exhaust = this.add.graphics().setDepth(19);
    this.exhaustFire = this.add.graphics().setDepth(18.6);
    this.exhaustSmoke = this.add.graphics().setDepth(18);
    this.primaryEngineView = null;
    this.primaryEngineDefinition = null;
    this.primaryEngineBottom = Number.NEGATIVE_INFINITY;

    this.build.forEach((part) => {
      const definition = PARTS_BY_ID[part.partId];
      if (!definition) {
        return;
      }

      const partView = new ShipPart(
        this,
        (part.cellX + definition.gridWidth / 2 - center.x) * ROCKET_CELL_SIZE,
        (part.cellY + definition.gridHeight / 2 - center.y) * ROCKET_CELL_SIZE,
        definition,
        {
          cellSize: ROCKET_CELL_SIZE,
          padding: 0,
          showLabel: false,
          showPlate: false,
        },
      );
      this.rocket.add(partView);

      if (definition.type === "engine") {
        const partBottom = part.cellY + definition.gridHeight;
        if (partBottom > this.primaryEngineBottom) {
          this.primaryEngineBottom = partBottom;
          this.primaryEngineView = partView;
          this.primaryEngineDefinition = definition;
        }
      }
    });
  }

  createHud() {
    this.hud = new FlightHud(this, {
      onEngineToggle: () => this.toggleEngine(),
    });
    this.hud.create();

    this.touchControlsUi = new FlightTouchControls(this, {
      onSteerLeft: (active) => {
        this.touchControls.steerLeft = active;
      },
      onSteerRight: (active) => {
        this.touchControls.steerRight = active;
      },
      onThrottleUp: (active) => {
        this.touchControls.throttleUp = active;
      },
      onThrottleDown: (active) => {
        this.touchControls.throttleDown = active;
      },
    });
    this.touchControlsUi.create();
  }

  update(time, delta) {
    this.updateControls(delta);

    const state = this.simulator.update(delta, this.controls);
    const prediction = this.simulator.predictPath(state);
    if (this.lastPhaseId !== state.phaseId) {
      this.handlePhaseTransition(state);
      this.lastPhaseId = state.phaseId;
    }

    this.renderFlight(state, prediction, time, delta);
    this.updateHud(state, prediction);
    this.handleMissionEnd(state);
    this.updateAudio(state);
  }

  updateAudio(state) {
    if (!this.audio) return;
    if (state.throttle > 0) {
      this.audio.startEngine();
      this.audio.updateEngine(state.throttle, state.altitude);
    } else {
      this.audio.stopEngine();
    }
    if (state.altitude > 500 && state.altitude < 15000 && state.verticalVelocity > 0.5) {
      if (!this.lastWhooshAlt || Math.abs(state.altitude - this.lastWhooshAlt) > 2000) {
        this.audio.playAtmosphereWhoosh(state.verticalVelocity);
        this.lastWhooshAlt = state.altitude;
      }
    }
    const speed = Math.sqrt(state.verticalVelocity ** 2 + state.horizontalVelocity ** 2);
    if (speed > 1.0 && !this.sonicBoomPlayed && state.altitude < 20000) {
      this.audio.playSonicBoom();
      this.sonicBoomPlayed = true;
    }
  }
}

Object.assign(
  FlightScene.prototype,
  flightSceneEnvironmentMethods,
  flightSceneOverlayMethods,
  flightSceneRuntimeMethods,
);

export default FlightScene;
