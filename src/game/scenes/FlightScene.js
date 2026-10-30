import Phaser from "phaser";
import { getRocket, getRocketTextureKey, loadSelectedRocketId } from "../data/rockets.js";
import FlightHud from "../ui/FlightHud.js";
import FlightTouchControls from "../ui/FlightTouchControls.js";
import { ROCKET_CELL_SIZE } from "./flight/FlightSceneConstants.js";
import { flightSceneEnvironmentMethods } from "./flight/FlightSceneEnvironment.js";
import { flightSceneExhaustMethods } from "./flight/FlightSceneExhaust.js";
import { flightSceneOverlayMethods } from "./flight/FlightSceneOverlay.js";
import { flightSceneRuntimeMethods } from "./flight/FlightSceneRuntime.js";
import { flightSceneSpeedMethods } from "./flight/FlightSceneSpeed.js";
import { createFlightRuntimeState } from "./flight/FlightSceneState.js";

class FlightScene extends Phaser.Scene {
  constructor() {
    super({ key: "FlightScene" });
  }

  init(data) {
    this.rocketDef = getRocket(data.rocketId || loadSelectedRocketId());
    this.stats = this.rocketDef.stats;
    this.audio = this.registry.get("audio");
    this.audio?.resume();
  }

  create() {
    this.initializeState();
    this.createBackdrop();
    this.createWorld();
    this.createRocket();
    this.createSpeedEffects();
    this.createHud();
    this.createMissionOverlay();
    this.createBackdropCamera();
    this.createUiCamera();
    this.registerInput();
    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.handleResize({ width: this.scale.width, height: this.scale.height });
  }

  initializeState() {
    Object.assign(this, createFlightRuntimeState(this.input, this.stats));
    this.onResultPrimary = (event) => {
      if (this.resultOverlayVisible && !event?.repeat) {
        this.handleResultPrimaryAction();
      }
    };
    this.onEscapeToHangar = () => this.returnToHangar();
  }

  // The container origin is the bottom centre of the rocket: the point that
  // sits on the pad and that the physics position describes.
  createRocket() {
    const image = this.add.image(0, 0, getRocketTextureKey(this.rocketDef)).setOrigin(0.5, 1);
    this.rocketHeight = this.rocketDef.height * ROCKET_CELL_SIZE;
    image.setScale(this.rocketHeight / image.height);
    this.rocketWidth = image.displayWidth;

    this.rocket = this.add.container(0, 0, [image]).setDepth(20);
    this.createExhaust();
    this.drawLaunchPad();
  }

  createHud() {
    this.hud = new FlightHud(this);
    this.hud.create();

    this.touchControlsUi = new FlightTouchControls(this, {
      onSteerLeft: (active) => {
        this.touchControls.steerLeft = active;
      },
      onSteerRight: (active) => {
        this.touchControls.steerRight = active;
      },
      onThrust: (active) => {
        this.touchControls.thrust = active;
      },
    });
    this.touchControlsUi.create();
  }

  update(time, delta) {
    this.updateControls();

    const state = this.simulator.update(delta, this.controls);
    const prediction = this.simulator.predictPath(state);
    if (this.lastPhaseId !== state.phaseId) {
      this.handlePhaseTransition(state);
      this.lastPhaseId = state.phaseId;
    }

    this.renderFlight(state, prediction, time, delta);
    this.updateHud(state);
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
    if (state.altitude > 5 && state.altitude < 90 && state.verticalVelocity > 0.5) {
      if (!this.lastWhooshAlt || Math.abs(state.altitude - this.lastWhooshAlt) > 25) {
        this.audio.playAtmosphereWhoosh(state.verticalVelocity);
        this.lastWhooshAlt = state.altitude;
      }
    }
    if (state.speed > 1.0 && !this.sonicBoomPlayed && state.altitude < 40) {
      this.audio.playSonicBoom();
      this.showVaporCone();
      this.sonicBoomPlayed = true;
    }
  }
}

Object.assign(
  FlightScene.prototype,
  flightSceneEnvironmentMethods,
  flightSceneExhaustMethods,
  flightSceneOverlayMethods,
  flightSceneRuntimeMethods,
  flightSceneSpeedMethods,
);

export default FlightScene;
