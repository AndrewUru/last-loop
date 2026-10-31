import Phaser from "phaser";
import { getRocket, getRocketTextureKey, loadSelectedRocketId } from "../data/rockets.js";
import FlightHud from "../ui/FlightHud.js";
import FlightTouchControls from "../ui/FlightTouchControls.js";
import { CAMERA_PAD_FILL, ROCKET_CELL_SIZE } from "./flight/FlightSceneConstants.js";
import { flightSceneCloudMethods } from "./flight/FlightSceneClouds.js";
import { flightSceneEnvironmentMethods } from "./flight/FlightSceneEnvironment.js";
import { flightSceneExhaustMethods } from "./flight/FlightSceneExhaust.js";
import { flightSceneMissionMethods } from "./flight/FlightSceneMission.js";
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
    this.createClouds();
    this.createSpeedEffects();
    this.createHud();
    this.createMission();
    this.createMissionOverlay();
    this.createLaunchCountdown();
    this.createBackdropCamera();
    this.createUiCamera();
    this.registerInput();
    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.handleResize({ width: this.scale.width, height: this.scale.height });
  }

  initializeState() {
    const challenge = this.rocketDef.challenge;
    Object.assign(
      this,
      createFlightRuntimeState(this.input, this.stats, {
        wind: challenge.wind,
        windPhase: Math.random() * Math.PI * 2,
      }),
    );
    this.onResultPrimary = (event) => {
      if (this.resultOverlayVisible && !event?.repeat) {
        this.handleResultPrimaryAction();
      }
    };
    this.onEscapeToHangar = () => this.returnToHangar();
  }

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
      onSteerLeft: (active) => { this.touchControls.steerLeft = active; },
      onSteerRight: (active) => { this.touchControls.steerRight = active; },
      onThrust: (active) => { this.touchControls.thrust = active; },
    });
    this.touchControlsUi.create();
  }

  createLaunchCountdown() {
    const { width, height } = this.scale;
    this.launchCountdownText = this.add
      .text(width / 2, height * 0.24, "5", {
        fontFamily: "Arial, sans-serif",
        fontSize: `${Math.round(Math.min(width, height) * 0.16)}px`,
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#08111f",
        strokeThickness: 8,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  applyLaunchCinematicCamera(state, remainingMs = 0) {
    const { width, height } = this.scale;
    const minViewport = Math.min(width, height);
    const padZoom =
      (minViewport * CAMERA_PAD_FILL) / Math.max(this.rocketHeight, ROCKET_CELL_SIZE * 3);

    if (this.launchSequence?.active && remainingMs <= 1000) {
      const ignitionProgress = Phaser.Math.Clamp((1000 - remainingMs) / 1000, 0, 1);
      const eased = Phaser.Math.Easing.Cubic.Out(ignitionProgress);
      const closeZoom = padZoom * 3.15;
      const zoom = Phaser.Math.Linear(padZoom, closeZoom, eased);
      const engineY = this.rocket.y - this.rocketHeight * 0.08;
      const targetY = Phaser.Math.Linear(this.rocket.y - this.rocketHeight * 0.45, engineY, eased);
      this.cameras.main.setZoom(zoom);
      this.cameras.main.centerOn(this.rocket.x, targetY);
      Object.assign(this.cameraState, { initialized: true, x: this.rocket.x, y: targetY, zoom });
      return;
    }

    // Hold the launch-site shot for the first kilometre, then hand over to the
    // normal chase camera smoothly between 1 and 2 km of real flight altitude.
    if (!this.launchSequence?.active && state.launched && state.altitude < 2) {
      const catchUp = Phaser.Math.Clamp((state.altitude - 1) / 1, 0, 1);
      const blend = catchUp * catchUp * (3 - 2 * catchUp);
      const chase = { ...this.cameraState };
      const planetRadius = Math.hypot(state.position.x, state.position.y) - state.altitude;
      const launchY = -planetRadius - this.rocketHeight * 0.42;
      const launchZoom = padZoom * 0.92;
      const targetX = Phaser.Math.Linear(0, chase.x, blend);
      const targetY = Phaser.Math.Linear(launchY, chase.y, blend);
      const zoom = Phaser.Math.Linear(launchZoom, chase.zoom, blend);
      this.cameras.main.setZoom(zoom);
      this.cameras.main.centerOn(targetX, targetY);
    }
  }

  updateLaunchCountdown(delta) {
    const sequence = this.launchSequence;
    if (!sequence?.active) return false;
    sequence.elapsed += delta;
    const remainingMs = Math.max(0, sequence.duration - sequence.elapsed);
    sequence.remainingMs = remainingMs;
    const second = Math.max(1, Math.ceil(remainingMs / 1000));

    if (second !== sequence.lastSecond) {
      sequence.lastSecond = second;
      this.launchCountdownText?.setText(String(second)).setScale(1.18).setAlpha(1);
      this.tweens.add({ targets: this.launchCountdownText, scale: 1, duration: 240, ease: "Cubic.easeOut" });
    }

    if (remainingMs <= 1000 && !sequence.ignitionStarted) {
      sequence.ignitionStarted = true;
      this.launchCountdownText?.setText("IGNITION").setScale(0.72);
      this.cameras.main.shake(900, 0.006);
    }

    if (remainingMs <= 0) {
      sequence.active = false;
      sequence.completed = true;
      this.launchCountdownText?.setText("LIFTOFF");
      this.tweens.add({
        targets: this.launchCountdownText,
        alpha: 0,
        scale: 1.35,
        duration: 520,
        ease: "Cubic.easeOut",
        onComplete: () => this.launchCountdownText?.destroy(),
      });
      this.cameraState.initialized = false;
      return false;
    }

    this.controls.engineOn = false;
    this.controls.throttle = 0;
    this.controls.steer = 0;
    return true;
  }

  update(time, delta) {
    if (this.updateLaunchCountdown(delta)) {
      const state = this.simulator.update(0, this.controls);
      const prediction = this.simulator.predictPath(state);
      this.renderFlight(state, prediction, time, delta);
      this.applyLaunchCinematicCamera(state, this.launchSequence.remainingMs);
      this.updateHud(state);
      return;
    }

    this.updateControls();
    const state = this.simulator.update(delta, this.controls);
    const prediction = this.simulator.predictPath(state);
    if (this.lastPhaseId !== state.phaseId) {
      this.handlePhaseTransition(state);
      this.lastPhaseId = state.phaseId;
    }
    this.renderFlight(state, prediction, time, delta);
    this.applyLaunchCinematicCamera(state);
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
  flightSceneCloudMethods,
  flightSceneEnvironmentMethods,
  flightSceneExhaustMethods,
  flightSceneMissionMethods,
  flightSceneOverlayMethods,
  flightSceneRuntimeMethods,
  flightSceneSpeedMethods,
);

export default FlightScene;
