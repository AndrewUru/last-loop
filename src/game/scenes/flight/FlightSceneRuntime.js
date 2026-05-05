import Phaser from "phaser";
import {
  FLIGHT_PHASES,
  FLIGHT_TARGETS,
  FLIGHT_WORLD,
} from "../../systems/FlightSimulator.js";
import {
  CURVATURE_REVEAL_END_ALTITUDE,
  CURVATURE_REVEAL_START_ALTITUDE,
  DAY_SKY_FADE_END_ALTITUDE,
  DAY_SKY_FADE_START_ALTITUDE,
  FLAT_GROUND_FADE_ALTITUDE,
  GUIDANCE_REVEAL_ALTITUDE,
  INITIAL_CAMERA_ZOOM,
  LAUNCH_CAMERA_CENTER_OFFSET,
  LAUNCH_PARTICLE_ALTITUDE,
  MAX_CAMERA_ZOOM,
  MAX_ZOOM_FACTOR,
  MIN_CAMERA_ZOOM,
  MIN_ORBIT_CAMERA_ZOOM,
  MIN_ZOOM_FACTOR,
  ORBIT_CAMERA_END_ALTITUDE,
  ORBIT_CAMERA_START_ALTITUDE,
  PAD_FADE_ALTITUDE,
  PLANET_REVEAL_ALTITUDE,
  ROCKET_CELL_SIZE,
  TRAIL_LIMIT,
} from "./FlightSceneConstants.js";
import {
  acquireParticle,
  angleDifference,
  getRenderPosition,
  getThrustVisual,
  releaseParticle,
  updateZoomFactor,
} from "./FlightSceneUtils.js";

export const flightSceneRuntimeMethods = {
  getExhaustAnchor() {
    if (!this.primaryEngineView || !this.primaryEngineDefinition) {
      return {
        x: this.rocket.x,
        y: this.rocket.y + 28,
      };
    }

    const engineHeight =
      this.primaryEngineView.sprite?.displayHeight ??
      this.primaryEngineDefinition.gridHeight * ROCKET_CELL_SIZE;
    const localY =
      this.primaryEngineView.y +
      engineHeight * (this.primaryEngineDefinition.exhaustOffsetY ?? 0.42);
    const localX = this.primaryEngineView.x;
    const rotation = this.rocket.rotation;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return {
      x: this.rocket.x + localX * cos - localY * sin,
      y: this.rocket.y + localX * sin + localY * cos,
    };
  },

  getVisualOrientation() {
    return this.rocket.rotation - Math.PI / 2;
  },

  registerInput() {
    this.input.mouse?.disableContextMenu();
    this.input.addPointer(2);
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointerupoutside", this.handlePointerUp, this);
    this.input.on("wheel", this.handleMouseWheel, this);
    this.input.keyboard.on("keydown-H", this.onToggleHelp);
    this.input.keyboard.on("keydown-R", this.onResultRebuild);
    this.input.keyboard.on("keydown-SPACE", this.onResultRelaunch);
    this.input.keyboard.on("keydown-ESC", this.onEscapeToBuild);
  },

  handleShutdown() {
    this.scale.off("resize", this.handleResize, this);
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.input.off("pointermove", this.handlePointerMove, this);
    this.input.off("pointerup", this.handlePointerUp, this);
    this.input.off("pointerupoutside", this.handlePointerUp, this);
    this.input.off("wheel", this.handleMouseWheel, this);
    this.input.keyboard.off("keydown-H", this.onToggleHelp);
    this.input.keyboard.off("keydown-R", this.onResultRebuild);
    this.input.keyboard.off("keydown-SPACE", this.onResultRelaunch);
    this.input.keyboard.off("keydown-ESC", this.onEscapeToBuild);
  },

  handlePointerDown(pointer) {
    if (pointer.pointerType === "touch") {
      this.trackTouchPointer(pointer);
      return;
    }

    if (!pointer.rightButtonDown() && !pointer.middleButtonDown()) {
      return;
    }

    this.cameraDrag = {
      pointerId: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      originPanX: this.cameraState.panX,
      originPanY: this.cameraState.panY,
    };
  },

  handlePointerMove(pointer) {
    if (pointer.pointerType === "touch") {
      this.updateTouchPointer(pointer);
      this.updatePinchZoom();
      return;
    }

    if (!this.cameraDrag || this.cameraDrag.pointerId !== pointer.id) {
      return;
    }

    const zoom = Math.max(this.cameraState.zoom, 0.001);
    this.cameraState.panX =
      this.cameraDrag.originPanX - (pointer.x - this.cameraDrag.startX) / zoom;
    this.cameraState.panY =
      this.cameraDrag.originPanY - (pointer.y - this.cameraDrag.startY) / zoom;
  },

  handlePointerUp(pointer) {
    if (pointer.pointerType === "touch") {
      this.releaseTouchPointer(pointer);
      return;
    }

    if (this.cameraDrag?.pointerId === pointer.id) {
      this.cameraDrag = null;
    }
  },

  trackTouchPointer(pointer) {
    this.activeTouchPointers.set(pointer.id, {
      x: pointer.x,
      y: pointer.y,
    });

    if (this.activeTouchPointers.size === 2) {
      this.pinchZoom = {
        distance: this.getPinchDistance(),
        zoomFactor: this.cameraState.zoomFactor,
      };
    }
  },

  updateTouchPointer(pointer) {
    if (!this.activeTouchPointers.has(pointer.id)) {
      return;
    }

    this.activeTouchPointers.set(pointer.id, {
      x: pointer.x,
      y: pointer.y,
    });
  },

  releaseTouchPointer(pointer) {
    this.activeTouchPointers.delete(pointer.id);
    this.pinchZoom = null;
  },

  getPinchDistance() {
    const touches = Array.from(this.activeTouchPointers.values());
    if (touches.length < 2) {
      return 0;
    }

    return Phaser.Math.Distance.Between(
      touches[0].x,
      touches[0].y,
      touches[1].x,
      touches[1].y,
    );
  },

  updatePinchZoom() {
    if (!this.pinchZoom || this.activeTouchPointers.size < 2) {
      return;
    }

    const distance = this.getPinchDistance();
    if (distance <= 0 || this.pinchZoom.distance <= 0) {
      return;
    }

    this.cameraState.zoomFactor = Phaser.Math.Clamp(
      this.pinchZoom.zoomFactor * (distance / this.pinchZoom.distance),
      MIN_ZOOM_FACTOR,
      MAX_ZOOM_FACTOR,
    );
  },

  handleMouseWheel(pointer, over, deltaX, deltaY) {
    this.cameraState.zoomFactor = updateZoomFactor(
      this.cameraState.zoomFactor,
      deltaY,
    );
  },

  updateControls(delta) {
    if (this.finished) {
      this.controls.steer = 0;
      this.controls.throttle = 0;
      return;
    }

    if (
      Phaser.Input.Keyboard.JustDown(this.keys.space) ||
      Phaser.Input.Keyboard.JustDown(this.keys.f)
    ) {
      this.toggleEngine();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.g)) {
      this.toggleAssist();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.zero)) {
      this.setCruiseThrottle(0);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.one)) {
      this.setCruiseThrottle(0.35);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.two)) {
      this.setCruiseThrottle(0.65);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.three)) {
      this.setCruiseThrottle(0.85);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.four)) {
      this.setCruiseThrottle(1);
    }

    const upPressed =
      this.keys.up.isDown || this.keys.w.isDown || this.touchControls.throttleUp;
    const downPressed =
      this.keys.down.isDown || this.keys.s.isDown || this.touchControls.throttleDown;
    const leftPressed =
      this.keys.left.isDown || this.keys.a.isDown || this.touchControls.steerLeft;
    const rightPressed =
      this.keys.right.isDown || this.keys.d.isDown || this.touchControls.steerRight;

    if (upPressed) {
      this.controls.engineOn = true;
      this.controls.cruiseThrottle = Math.min(
        1,
        this.controls.cruiseThrottle + delta * 0.001,
      );
    }
    if (downPressed) {
      this.controls.cruiseThrottle = Math.max(
        0,
        this.controls.cruiseThrottle - delta * 0.001,
      );
    }
    if (this.touchControls.throttleDown && this.controls.cruiseThrottle <= 0.01) {
      this.controls.engineOn = false;
    }

    if (this.simulator.state.fuelRemaining <= 0.01) {
      this.controls.engineOn = false;
    }

    this.controls.steer = (rightPressed ? 1 : 0) - (leftPressed ? 1 : 0);
    const requestedThrottle = this.controls.engineOn
      ? this.keys.shift.isDown
        ? 1
        : this.controls.cruiseThrottle
      : 0;

    this.controls.requestedThrottle = requestedThrottle;
    this.controls.throttle = this.getAssistedThrottle(requestedThrottle);
  },

  toggleEngine() {
    this.controls.engineOn = !this.controls.engineOn;
  },

  toggleAssist() {
    this.controls.assistEnabled = !this.controls.assistEnabled;
  },

  setCruiseThrottle(value) {
    this.controls.cruiseThrottle = Phaser.Math.Clamp(value, 0, 1);
  },

  getAssistedThrottle(requestedThrottle) {
    this.controls.autoThrottleActive = false;

    if (!this.controls.assistEnabled || requestedThrottle <= 0) {
      return requestedThrottle;
    }

    const state = this.simulator.state;
    if (!state?.launched) {
      return requestedThrottle;
    }

    const horizontalSpeed = Math.abs(state.horizontalVelocity);
    const nearOrbitSpeed =
      horizontalSpeed >= FLIGHT_TARGETS.orbitalVelocity * 1.08;
    const nearOrbitAltitude =
      state.altitude >= FLIGHT_WORLD.orbitMinAltitude - 15;
    const climbingPastTarget =
      state.altitude >= FLIGHT_WORLD.targetOrbitAltitude + 46 &&
      state.verticalVelocity > 0;

    if ((nearOrbitSpeed && nearOrbitAltitude) || climbingPastTarget) {
      this.controls.autoThrottleActive = true;
      return 0;
    }

    if (
      state.altitude >= FLIGHT_WORLD.turnStartAltitude &&
      state.verticalVelocity > FLIGHT_WORLD.orbitVerticalTolerance * 4
    ) {
      const cappedThrottle = Math.min(requestedThrottle, 0.58);
      this.controls.autoThrottleActive = cappedThrottle < requestedThrottle;
      return cappedThrottle;
    }

    return requestedThrottle;
  },

  renderFlight(state, prediction, time, delta) {
    this.updateTrail(state);
    this.updateGuidance(prediction);
    this.updateCamera(state);
    this.updateWorldVisuals(state);
    this.updateRocketPose(state);
    this.updateExhaust(state, time, delta);
    this.updateLaunchMomentum(state, time);
  },

  updateHud(state, prediction) {
    this.hud.update(state, {
      stats: this.stats,
      predictionSummary: prediction,
      controls: this.controls,
    });
  },

  handlePhaseTransition(state) {
    if (state.phaseId === FLIGHT_PHASES.LIFTOFF && state.launched) {
      this.cameras.main.shake(260, 0.004);
      return;
    }

    if (state.phaseId === FLIGHT_PHASES.GRAVITY_TURN) {
      this.cameras.main.shake(160, 0.0022);
      return;
    }

    if (
      state.phaseId === FLIGHT_PHASES.ORBIT_PUSH ||
      state.phaseId === FLIGHT_PHASES.ORBIT
    ) {
      this.cameras.main.shake(112, 0.0015);
    }
  },

  handleMissionEnd(state) {
    if (this.finished || !state.result) {
      return;
    }

    this.finished = true;
    this.controls.engineOn = false;
    this.controls.throttle = 0;
    this.controls.steer = 0;

    const snapshot = {
      result: state.result,
      reason: state.reason,
      altitude: Math.max(state.altitude, state.apoapsis || 0),
      horizontalVelocity: Math.abs(state.horizontalVelocity),
      fuelRemaining: state.fuelRemaining,
      time: state.time,
    };

    this.time.delayedCall(state.result === "success" ? 900 : 1200, () => {
      this.showMissionOverlay(snapshot);
    });
  },

  updateCamera(state) {
    const renderPosition = getRenderPosition(state);
    const altitudeProgress = Phaser.Math.Clamp(
      renderPosition.altitude / FLIGHT_WORLD.targetOrbitAltitude,
      0,
      1,
    );
    const orbitBlend = Phaser.Math.Clamp(
      (renderPosition.altitude - ORBIT_CAMERA_START_ALTITUDE) /
        (ORBIT_CAMERA_END_ALTITUDE - ORBIT_CAMERA_START_ALTITUDE),
      0,
      1,
    );
    const minViewport = Math.min(this.scale.width, this.scale.height);
    const viewRadius = Phaser.Math.Linear(
      FLIGHT_WORLD.planetRadius + 80,
      FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude + 80,
      altitudeProgress,
    );
    const orbitalZoom = Phaser.Math.Clamp(
      (minViewport * 0.42) / viewRadius,
      MIN_ORBIT_CAMERA_ZOOM,
      1.9,
    );
    const launchLockProgress = Math.pow(
      Phaser.Math.Clamp(state.altitude / 92, 0, 1),
      1.65,
    );
    const framingY = Phaser.Math.Linear(28, 102, orbitBlend);
    const automaticZoom = Phaser.Math.Linear(
      INITIAL_CAMERA_ZOOM,
      orbitalZoom,
      orbitBlend,
    );
    const desiredCenterX = renderPosition.x + this.cameraState.panX;
    const launchCenterY =
      -FLIGHT_WORLD.planetRadius +
      LAUNCH_CAMERA_CENTER_OFFSET +
      this.cameraState.panY;
    const followCenterY = renderPosition.y + framingY + this.cameraState.panY;
    const desiredCenterY = Phaser.Math.Linear(
      launchCenterY,
      followCenterY,
      launchLockProgress,
    );
    const overviewProgress = Phaser.Math.Clamp(
      (0.72 - automaticZoom * this.cameraState.zoomFactor) / 0.4,
      0,
      1,
    );
    const overviewCenterX = this.cameraState.panX;
    const overviewCenterY = this.cameraState.panY;
    const framedCenterX = Phaser.Math.Linear(
      desiredCenterX,
      overviewCenterX,
      overviewProgress,
    );
    const framedCenterY = Phaser.Math.Linear(
      desiredCenterY,
      overviewCenterY,
      overviewProgress,
    );
    const desiredZoom = Phaser.Math.Clamp(
      automaticZoom * this.cameraState.zoomFactor,
      MIN_CAMERA_ZOOM,
      MAX_CAMERA_ZOOM,
    );
    const cameraFollow = Phaser.Math.Linear(0.075, 0.11, orbitBlend);

    this.cameraState.centerX = Phaser.Math.Linear(
      this.cameraState.centerX,
      framedCenterX,
      cameraFollow,
    );
    this.cameraState.centerY = Phaser.Math.Linear(
      this.cameraState.centerY,
      framedCenterY,
      cameraFollow,
    );
    this.cameraState.zoom = Phaser.Math.Linear(
      this.cameraState.zoom,
      desiredZoom,
      0.16,
    );

    this.cameras.main.centerOn(
      this.cameraState.centerX,
      this.cameraState.centerY,
    );
    this.cameras.main.setZoom(this.cameraState.zoom);
  },

  updateWorldVisuals(state) {
    const dayToSpace = Phaser.Math.Clamp(
      (state.altitude - DAY_SKY_FADE_START_ALTITUDE) /
        (DAY_SKY_FADE_END_ALTITUDE - DAY_SKY_FADE_START_ALTITUDE),
      0,
      1,
    );
    const overlayProgress = Phaser.Math.Clamp(
      (state.altitude - GUIDANCE_REVEAL_ALTITUDE) / 150,
      0,
      1,
    );
    const curvatureReveal = Phaser.Math.Clamp(
      (state.altitude - CURVATURE_REVEAL_START_ALTITUDE) /
        (CURVATURE_REVEAL_END_ALTITUDE - CURVATURE_REVEAL_START_ALTITUDE),
      0,
      1,
    );
    const planetReveal = Phaser.Math.Clamp(
      (state.altitude - PLANET_REVEAL_ALTITUDE) / 160,
      0,
      1,
    );
    const padFade = Phaser.Math.Clamp(
      1 - state.altitude / PAD_FADE_ALTITUDE,
      0,
      1,
    );
    const flatGroundFade = Phaser.Math.Clamp(
      1 - state.altitude / FLAT_GROUND_FADE_ALTITUDE,
      0,
      1,
    );

    this.spaceShade.setAlpha(Phaser.Math.Linear(0, 0.96, dayToSpace));
    this.stars.forEach((star) => {
      star.setAlpha(Phaser.Math.Linear(0, 1, dayToSpace * dayToSpace));
    });

    this.orbitBand.setAlpha(Phaser.Math.Linear(0.02, 0.28, overlayProgress));
    this.orbitGuides.setAlpha(Phaser.Math.Linear(0.04, 0.56, overlayProgress));
    this.planetBody.setAlpha(
      Phaser.Math.Linear(0, Phaser.Math.Linear(0.9, 1, planetReveal), curvatureReveal),
    );
    this.planetAtmosphere.setAlpha(
      Phaser.Math.Linear(0, Phaser.Math.Linear(1, 0.48, dayToSpace), curvatureReveal),
    );
    this.planetLight.setAlpha(0);
    this.horizonGlow.setAlpha(0);
    this.highAltitudeHorizon.setAlpha(0);
    this.atmosphereShell.setAlpha(0);
    this.launchBackdrop.setAlpha(Phaser.Math.Linear(0.9, 0, 1 - padFade));
    this.launchGround.setAlpha(Phaser.Math.Linear(1, 0, 1 - flatGroundFade));
    this.pad.setAlpha(padFade * 0.84);
    this.launchTower.setAlpha(padFade * 0.9);

    this.launchTowerGlow.clear();
    if (padFade > 0.05) {
      this.launchTowerGlow.fillStyle(
        0xffa86d,
        (0.04 + state.throttle * 0.06) * padFade,
      );
      this.launchTowerGlow.fillEllipse(
        -66,
        -FLIGHT_WORLD.planetRadius - 116,
        44,
        44,
      );
      this.launchTowerGlow.fillStyle(0x73f7c0, 0.04 * padFade);
      this.launchTowerGlow.fillEllipse(
        -40,
        -FLIGHT_WORLD.planetRadius - 8,
        64,
        28,
      );
    }

    this.padGlow.clear();
    if (state.engineOn && state.throttle > 0 && padFade > 0.05) {
      this.padGlow.fillStyle(0xff9d5c, state.throttle * padFade * 0.16);
      this.padGlow.fillEllipse(0, -FLIGHT_WORLD.planetRadius + 44, 220, 54);
    }
  },

  updateTrail(state) {
    if (!state.launched && this.flightTrail.length === 0) {
      return;
    }

    this.flightTrail.push({ x: state.position.x, y: state.position.y });
    if (this.flightTrail.length > TRAIL_LIMIT) {
      this.flightTrail.shift();
    }

    this.trailGraphics.clear();
    if (this.flightTrail.length < 2) {
      return;
    }

    const speedFeel = Phaser.Math.Clamp(
      (Math.abs(state.verticalVelocity) + Math.abs(state.horizontalVelocity) * 0.35) / 1.6,
      0,
      1,
    );

    this.trailGraphics.lineStyle(
      2 + speedFeel * 1.6,
      0xffd773,
      0.32 + speedFeel * 0.28,
    );
    this.trailGraphics.beginPath();
    this.trailGraphics.moveTo(this.flightTrail[0].x, this.flightTrail[0].y);
    for (let index = 1; index < this.flightTrail.length; index += 1) {
      this.trailGraphics.lineTo(
        this.flightTrail[index].x,
        this.flightTrail[index].y,
      );
    }
    this.trailGraphics.strokePath();
  },

  updateGuidance(prediction) {
    this.trajectoryGraphics.clear();
    this.markerGraphics.clear();
    this.apoapsisLabel.setVisible(false);
    this.periapsisLabel.setVisible(false);
    this.corridorLabel.setVisible(false);

    if (prediction.apoapsis < GUIDANCE_REVEAL_ALTITUDE) {
      return;
    }

    if (prediction.points.length > 1) {
      this.trajectoryGraphics.lineStyle(2, 0x8fd7ff, 0.34);
      this.trajectoryGraphics.beginPath();
      this.trajectoryGraphics.moveTo(prediction.points[0].x, prediction.points[0].y);
      for (let index = 1; index < prediction.points.length; index += 1) {
        const point = prediction.points[index];
        this.trajectoryGraphics.lineTo(point.x, point.y);
      }
      this.trajectoryGraphics.strokePath();
    }

    prediction.points.forEach((point, index) => {
      if (index % 2 !== 0) {
        return;
      }
      const progress = index / Math.max(prediction.points.length - 1, 1);
      this.trajectoryGraphics.fillStyle(0x8fd7ff, 0.16 + progress * 0.18);
      this.trajectoryGraphics.fillCircle(point.x, point.y, 1.5 + progress * 1.4);
    });

    if (prediction.apoapsisPoint) {
      this.drawOrbitMarker(
        prediction.apoapsisPoint,
        0xffd773,
        this.apoapsisLabel,
        `AP ${prediction.apoapsis.toFixed(0)} km`,
        12,
        -22,
      );
    }

    if (prediction.periapsisPoint) {
      const periapsisSafe = prediction.periapsis >= FLIGHT_WORLD.orbitMinAltitude;
      this.drawOrbitMarker(
        prediction.periapsisPoint,
        periapsisSafe ? 0x73f7c0 : 0xff8d8d,
        this.periapsisLabel,
        `PE ${prediction.periapsis.toFixed(0)} km`,
        12,
        22,
      );
    }

    if (prediction.corridorPoint) {
      this.drawCorridorMarker(
        prediction.corridorPoint,
        `TARGET ${FLIGHT_WORLD.targetOrbitAltitude} km`,
      );
    }
  },

  drawOrbitMarker(point, color, label, text, offsetX, offsetY) {
    this.markerGraphics.lineStyle(2, color, 0.88);
    this.markerGraphics.strokeCircle(point.x, point.y, 8);
    this.markerGraphics.lineStyle(1, color, 0.55);
    this.markerGraphics.beginPath();
    this.markerGraphics.moveTo(point.x - 12, point.y);
    this.markerGraphics.lineTo(point.x + 12, point.y);
    this.markerGraphics.moveTo(point.x, point.y - 12);
    this.markerGraphics.lineTo(point.x, point.y + 12);
    this.markerGraphics.moveTo(point.x, point.y);
    this.markerGraphics.lineTo(point.x + offsetX, point.y + offsetY);
    this.markerGraphics.strokePath();

    label
      .setText(text)
      .setPosition(point.x + offsetX, point.y + offsetY)
      .setTint(color)
      .setVisible(true);
  },

  drawCorridorMarker(point, text) {
    const size = 8;
    this.markerGraphics.lineStyle(2, 0x73f7c0, 0.88);
    this.markerGraphics.beginPath();
    this.markerGraphics.moveTo(point.x, point.y - size);
    this.markerGraphics.lineTo(point.x + size, point.y);
    this.markerGraphics.lineTo(point.x, point.y + size);
    this.markerGraphics.lineTo(point.x - size, point.y);
    this.markerGraphics.closePath();
    this.markerGraphics.strokePath();
    this.markerGraphics.lineStyle(1, 0x73f7c0, 0.5);
    this.markerGraphics.beginPath();
    this.markerGraphics.moveTo(point.x, point.y);
    this.markerGraphics.lineTo(point.x + 12, point.y - 22);
    this.markerGraphics.strokePath();

    this.corridorLabel
      .setText(text)
      .setPosition(point.x + 12, point.y - 22)
      .setTint(0x73f7c0)
      .setVisible(true);
  },

  updateRocketPose(state) {
    const renderPosition = getRenderPosition(state);
    const launchPoseProgress = Phaser.Math.Clamp(
      (state.altitude - 34) / 110,
      0,
      1,
    );
    const targetRotation = state.orientation + Math.PI / 2;

    this.rocket.x = renderPosition.x;
    this.rocket.y = renderPosition.y;
    this.rocket.rotation =
      angleDifference(targetRotation, 0) * launchPoseProgress;
  },

  updateLaunchMomentum(state, time) {
    this.launchSpeedLines.clear();

    if (state.launched && !this.launchBurstPlayed) {
      this.launchBurstPlayed = true;
      this.cameras.main.shake(220, 0.0044);
    }
  },

  updateExhaust(state, time, delta) {
    const thrustVisual = getThrustVisual(state);
    const groundBoost = Phaser.Math.Clamp((80 - state.altitude) / 80, 0, 1);
    const speedFeel = Phaser.Math.Clamp(
      (Math.abs(state.verticalVelocity) + Math.abs(state.horizontalVelocity) * 0.25) / 1.3,
      0,
      1,
    );
    const flameLength =
      thrustVisual > 0
        ? 34 +
          Math.sin(time / 55) * 5 +
          thrustVisual * 24 +
          groundBoost * thrustVisual * 22 +
          speedFeel * 14
        : 0;

    this.exhaust.clear();
    this.exhaustFire.clear();
    this.exhaustSmoke.clear();
    this.updateLaunchParticles(state, delta / 1000);

    if (flameLength <= 0) {
      return;
    }

    this.drawExhaustFlame(thrustVisual, flameLength);
  },

  drawExhaustFlame(thrustVisual, flameLength) {
    const orientation = this.getVisualOrientation();
    const rear = this.getExhaustAnchor();
    const rearAngle = orientation + Math.PI / 2;
    const lateralX = Math.cos(rearAngle);
    const lateralY = Math.sin(rearAngle);
    const plumeX = -Math.cos(orientation);
    const plumeY = -Math.sin(orientation);
    const flickerTime = this.time.now * 0.045;
    const segmentCount = 7;

    this.exhaust.fillStyle(0xfff7d6, 0.98);
    this.exhaust.fillCircle(rear.x, rear.y, 6 + thrustVisual * 4);
    this.exhaust.fillStyle(0xffe7a8, 0.42);
    this.exhaust.fillCircle(rear.x, rear.y, 12 + thrustVisual * 6);

    for (let index = 0; index < segmentCount; index += 1) {
      const t = index / (segmentCount - 1);
      const plumeOffset = flameLength * (0.14 + t * 0.82);
      const wobble =
        Math.sin(flickerTime + index * 1.35) * (1 - t) * (2.2 + thrustVisual * 2.8);
      const px = rear.x + plumeX * plumeOffset + lateralX * wobble;
      const py = rear.y + plumeY * plumeOffset + lateralY * wobble;
      const outerRadius = Phaser.Math.Linear(9 + thrustVisual * 4, 2.4, t);
      const midRadius = outerRadius * Phaser.Math.Linear(0.76, 0.58, t);
      const coreRadius = outerRadius * Phaser.Math.Linear(0.42, 0.28, t);
      const alpha = Phaser.Math.Linear(0.72, 0.18, t);

      this.exhaust.fillStyle(0xff7b2f, alpha * 0.9);
      this.exhaust.fillCircle(px, py, outerRadius);
      this.exhaust.fillStyle(0xffb347, alpha * 0.95);
      this.exhaust.fillCircle(
        px - plumeX * outerRadius * 0.1,
        py - plumeY * outerRadius * 0.1,
        midRadius,
      );
      this.exhaust.fillStyle(0xfff2bf, Phaser.Math.Linear(0.8, 0.14, t));
      this.exhaust.fillCircle(
        px - plumeX * outerRadius * 0.18,
        py - plumeY * outerRadius * 0.18,
        coreRadius,
      );
    }

    const tipX = rear.x + plumeX * (flameLength * 0.98);
    const tipY = rear.y + plumeY * (flameLength * 0.98);
    this.exhaust.fillStyle(0xff8c3b, 0.26);
    this.exhaust.fillCircle(tipX, tipY, 2 + thrustVisual * 1.2);
  },

  updateLaunchParticles(state, dt) {
    const thrustVisual = getThrustVisual(state);
    const ignitionEmissionActive =
      state.launched &&
      state.altitude < LAUNCH_PARTICLE_ALTITUDE &&
      thrustVisual > 0;
    const ascentEmissionActive =
      state.launched &&
      state.altitude >= LAUNCH_PARTICLE_ALTITUDE &&
      state.altitude < DAY_SKY_FADE_END_ALTITUDE &&
      thrustVisual > 0;

    if (ignitionEmissionActive) {
      this.emitLaunchParticles(state, thrustVisual);
    }
    if (ascentEmissionActive) {
      this.emitAscentSmokeTrail(state, thrustVisual);
    }

    this.renderSmokeParticles(dt);
    this.renderFireParticles(dt);
  },

  emitLaunchParticles(state, thrustVisual) {
    const rear = this.getExhaustAnchor();
    const orientation = this.getVisualOrientation();
    const exhaustX = -Math.cos(orientation);
    const exhaustY = -Math.sin(orientation);
    const lateralX = Math.cos(orientation + Math.PI / 2);
    const lateralY = Math.sin(orientation + Math.PI / 2);
    const groundBoost = Phaser.Math.Clamp(
      (LAUNCH_PARTICLE_ALTITUDE - state.altitude) / LAUNCH_PARTICLE_ALTITUDE,
      0,
      1,
    );
    const intensity = thrustVisual * (1.15 + groundBoost * 1.6);
    const smokeCount = Math.round(Phaser.Math.Clamp(3 + intensity * 3, 3, 8));
    const fireCount = Math.round(Phaser.Math.Clamp(2 + intensity * 2.5, 2, 6));

    for (let index = 0; index < smokeCount; index += 1) {
      const particle = acquireParticle(this.smokeParticlePool);
      if (!particle) {
        break;
      }

      const spread = Phaser.Math.FloatBetween(-28, 28);
      particle.x = rear.x + lateralX * spread + Phaser.Math.FloatBetween(-6, 6);
      particle.y = rear.y + lateralY * spread + Phaser.Math.FloatBetween(-4, 8);
      particle.vx =
        exhaustX * Phaser.Math.FloatBetween(18, 58) +
        lateralX * Phaser.Math.FloatBetween(-30, 30);
      particle.vy =
        exhaustY * Phaser.Math.FloatBetween(26, 70) +
        lateralY * Phaser.Math.FloatBetween(-20, 20);
      particle.size = Phaser.Math.FloatBetween(8, 14);
      particle.growth = Phaser.Math.FloatBetween(14, 28);
      particle.drag = Phaser.Math.FloatBetween(1.1, 1.8);
      particle.buoyancy = Phaser.Math.FloatBetween(90, 150);
      particle.life = Phaser.Math.FloatBetween(0.65, 1.1);
      particle.maxLife = particle.life;
      particle.variant = "ignition";
      this.smokeParticles.push(particle);
    }

    for (let index = 0; index < fireCount; index += 1) {
      const particle = acquireParticle(this.fireParticlePool);
      if (!particle) {
        break;
      }

      const spread = Phaser.Math.FloatBetween(-10, 10);
      particle.x = rear.x + lateralX * spread + Phaser.Math.FloatBetween(-3, 3);
      particle.y = rear.y + lateralY * spread + Phaser.Math.FloatBetween(-2, 4);
      particle.vx =
        exhaustX * Phaser.Math.FloatBetween(100, 185) +
        lateralX * Phaser.Math.FloatBetween(-38, 38);
      particle.vy =
        exhaustY * Phaser.Math.FloatBetween(110, 200) +
        lateralY * Phaser.Math.FloatBetween(-34, 34);
      particle.size = Phaser.Math.FloatBetween(3, 6);
      particle.growth = Phaser.Math.FloatBetween(24, 46);
      particle.drag = Phaser.Math.FloatBetween(2.8, 4.1);
      particle.life = Phaser.Math.FloatBetween(0.1, 0.2);
      particle.maxLife = particle.life;
      this.fireParticles.push(particle);
    }
  },

  emitAscentSmokeTrail(state, thrustVisual) {
    const rear = this.getExhaustAnchor();
    const orientation = this.getVisualOrientation();
    const exhaustX = -Math.cos(orientation);
    const exhaustY = -Math.sin(orientation);
    const lateralX = Math.cos(orientation + Math.PI / 2);
    const lateralY = Math.sin(orientation + Math.PI / 2);
    const speedFeel = Phaser.Math.Clamp(
      (Math.abs(state.verticalVelocity) + Math.abs(state.horizontalVelocity) * 0.35) / 1.8,
      0,
      1,
    );
    const smokeCount = Math.round(
      Phaser.Math.Clamp(0.8 + thrustVisual * 0.8 + speedFeel * 0.5, 1, 2),
    );

    for (let index = 0; index < smokeCount; index += 1) {
      const particle = acquireParticle(this.smokeParticlePool);
      if (!particle) {
        break;
      }

      const spread = Phaser.Math.FloatBetween(-5, 5);
      particle.x = rear.x + lateralX * spread + Phaser.Math.FloatBetween(-2, 2);
      particle.y = rear.y + lateralY * spread + Phaser.Math.FloatBetween(-2, 2);
      particle.vx =
        exhaustX * Phaser.Math.FloatBetween(46, 78) +
        lateralX * Phaser.Math.FloatBetween(-10, 10);
      particle.vy =
        exhaustY * Phaser.Math.FloatBetween(52, 92) +
        lateralY * Phaser.Math.FloatBetween(-10, 10);
      particle.size = Phaser.Math.FloatBetween(4, 7);
      particle.growth = Phaser.Math.FloatBetween(6, 12);
      particle.drag = Phaser.Math.FloatBetween(1.9, 2.7);
      particle.buoyancy = Phaser.Math.FloatBetween(18, 42);
      particle.life = Phaser.Math.FloatBetween(0.45, 0.8);
      particle.maxLife = particle.life;
      particle.variant = "trail";
      this.smokeParticles.push(particle);
    }
  },

  renderSmokeParticles(dt) {
    for (let index = this.smokeParticles.length - 1; index >= 0; index -= 1) {
      const particle = this.smokeParticles[index];
      particle.life -= dt;

      if (particle.life <= 0) {
        releaseParticle(this.smokeParticles, this.smokeParticlePool, index);
        continue;
      }

      const lifeRatio = particle.life / particle.maxLife;
      const ageRatio = 1 - lifeRatio;
      const damping = Math.max(0.1, 1 - particle.drag * dt * (1 + ageRatio));

      particle.vx *= damping;
      particle.vy *= damping;
      particle.vy -= particle.buoyancy * dt * ageRatio * 2;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;

      const currentGrowth =
        particle.variant === "trail"
          ? particle.growth * (0.35 + lifeRatio * 0.6)
          : particle.growth * (0.2 + lifeRatio * 1.8);
      particle.size += currentGrowth * dt;

      let alpha = Phaser.Math.Clamp(lifeRatio * 2, 0, 1);
      let coreColor;
      let midColor;
      let edgeColor;

      if (particle.variant === "trail") {
        if (lifeRatio > 0.65) {
          coreColor = 0xf7fbff;
          midColor = 0xd1d9e1;
          edgeColor = 0x9ba4ae;
        } else {
          coreColor = 0xa8b1ba;
          midColor = 0x6f7781;
          edgeColor = 0x454b53;
        }
        alpha *= 0.48;
      } else if (lifeRatio > 0.85) {
        coreColor = 0xffffff;
        midColor = 0xffe270;
        edgeColor = 0xff6600;
        alpha *= 0.6;
      } else if (lifeRatio > 0.5) {
        coreColor = 0xffffff;
        midColor = 0xe0e6ed;
        edgeColor = 0xbac3ce;
        alpha *= 0.4;
      } else {
        coreColor = 0xbac3ce;
        midColor = 0x858b92;
        edgeColor = 0x4a5058;
        alpha *= 0.25;
      }

      this.exhaustSmoke.fillStyle(edgeColor, alpha * 0.7);
      this.exhaustSmoke.fillCircle(particle.x, particle.y, particle.size);

      this.exhaustSmoke.fillStyle(midColor, alpha * 0.9);
      this.exhaustSmoke.fillCircle(
        particle.x + particle.size * 0.06,
        particle.y + particle.size * 0.04,
        particle.size * 0.74,
      );

      this.exhaustSmoke.fillStyle(coreColor, alpha);
      this.exhaustSmoke.fillCircle(
        particle.x - particle.size * 0.04,
        particle.y - particle.size * 0.02,
        particle.size * 0.45,
      );
    }
  },

  renderFireParticles(dt) {
    for (let index = this.fireParticles.length - 1; index >= 0; index -= 1) {
      const particle = this.fireParticles[index];
      particle.life -= dt;

      if (particle.life <= 0) {
        releaseParticle(this.fireParticles, this.fireParticlePool, index);
        continue;
      }

      const lifeRatio = particle.life / particle.maxLife;
      const damping = Math.max(0.12, 1 - particle.drag * 0.5 * dt);

      particle.vx *= damping;
      particle.vy *= damping;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.size += particle.growth * dt * lifeRatio;

      const alpha = Phaser.Math.Clamp(lifeRatio, 0, 1);
      let colorCore;
      let colorMid;
      let colorEdge;

      if (lifeRatio > 0.7) {
        colorCore = 0xffffff;
        colorMid = 0xfff0b3;
        colorEdge = 0xff9f2f;
      } else {
        colorCore = 0xff9f2f;
        colorMid = 0xff5d1a;
        colorEdge = 0x8b0000;
      }

      this.exhaustFire.fillStyle(colorEdge, alpha * 0.4);
      this.exhaustFire.fillCircle(particle.x, particle.y, particle.size * 1.2);

      this.exhaustFire.fillStyle(colorMid, alpha * 0.8);
      this.exhaustFire.fillCircle(particle.x, particle.y, particle.size * 0.8);

      const offsetX = particle.vx * 0.02;
      const offsetY = particle.vy * 0.02;

      this.exhaustFire.fillStyle(colorCore, alpha);
      this.exhaustFire.fillCircle(
        particle.x - offsetX,
        particle.y - offsetY,
        particle.size * 0.4,
      );
    }
  },
};
