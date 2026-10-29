import Phaser from "phaser";
import MissionSystem from "../../systems/MissionSystem.js";
import {
  FLIGHT_PHASES,
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
        y: this.rocket.y + 28 * this.getRocketVisualScale(),
      };
    }

    const engineHeight =
      this.primaryEngineView.sprite?.displayHeight ??
      this.primaryEngineDefinition.gridHeight * ROCKET_CELL_SIZE;
    const visualScale = this.getRocketVisualScale();
    const localY =
      (this.primaryEngineView.y +
        engineHeight * (this.primaryEngineDefinition.exhaustOffsetY ?? 0.42)) *
      visualScale;
    const localX = this.primaryEngineView.x * visualScale;
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

  getMapViewProgress() {
    return Phaser.Math.Clamp(
      (0.62 - this.cameraState.zoomFactor) / 0.42,
      0,
      1,
    );
  },

  getRocketVisualScale() {
    return Phaser.Math.Linear(1, 0.14, this.getMapViewProgress());
  },

  registerInput() {
    this.input.mouse?.disableContextMenu();
    this.input.addPointer(2);
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointerupoutside", this.handlePointerUp, this);
    this.input.on("wheel", this.handleMouseWheel, this);
    this.input.keyboard.on("keydown-ENTER", this.onResultPrimary);
    this.input.keyboard.on("keydown-ESC", this.onEscapeToBuild);
  },

  handleShutdown() {
    this.scale.off("resize", this.handleResize, this);
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.input.off("pointermove", this.handlePointerMove, this);
    this.input.off("pointerup", this.handlePointerUp, this);
    this.input.off("pointerupoutside", this.handlePointerUp, this);
    this.input.off("wheel", this.handleMouseWheel, this);
    this.input.keyboard.off("keydown-ENTER", this.onResultPrimary);
    this.input.keyboard.off("keydown-ESC", this.onEscapeToBuild);
  },

  handlePointerDown(pointer, currentlyOver = []) {
    if (pointer.wasTouch) {
      // Fingers on the touch buttons must not count towards pinch zoom.
      if (currentlyOver.length === 0) {
        this.trackTouchPointer(pointer);
      }
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
    if (pointer.wasTouch) {
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
    if (pointer.wasTouch) {
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

  updateControls() {
    if (this.finished) {
      this.controls.engineOn = false;
      this.controls.throttle = 0;
      this.controls.steer = 0;
      return;
    }

    const thrust =
      this.keys.space.isDown ||
      this.keys.up.isDown ||
      this.keys.w.isDown ||
      this.touchControls.thrust;
    const left = this.keys.left.isDown || this.keys.a.isDown || this.touchControls.steerLeft;
    const right = this.keys.right.isDown || this.keys.d.isDown || this.touchControls.steerRight;

    this.controls.engineOn = thrust;
    this.controls.throttle = thrust ? 1 : 0;
    this.controls.steer = (right ? 1 : 0) - (left ? 1 : 0);
  },

  renderFlight(state, prediction, time, delta) {
    this.updateTrail(state);
    this.updateTrajectory(state, prediction);
    this.updateCamera(state);
    this.updateWorldVisuals(state);
    this.updateRocketPose(state);
    this.updateGuidanceArrow(state);
    this.updateExhaust(state, time, delta);
    this.updateLaunchMomentum(state, time);
  },

  updateHud(state) {
    this.hud.update(state, { stats: this.stats });
    this.touchControlsUi.update(state);
  },

  handlePhaseTransition(state) {
    if (state.phaseId === FLIGHT_PHASES.ASCENT) {
      this.cameras.main.shake(260, 0.004);
    } else if (state.phaseId === FLIGHT_PHASES.ORBIT) {
      this.cameras.main.shake(112, 0.0015);
      this.audio?.playSuccess?.();
    }
  },

  handleMissionEnd(state) {
    if (this.finished || !state.result) {
      return;
    }

    this.finished = true;
    const success = state.result === "success";
    const fuelPercent =
      this.stats.fuel > 0 ? Math.round((state.fuelRemaining / this.stats.fuel) * 100) : 0;
    const completedMissions = MissionSystem.recordFlight({
      success,
      fuelPercent,
      partCount: this.build.length,
      time: state.time,
    });

    if (state.failure === FLIGHT_PHASES.CRASHED) {
      this.createExplosion();
      this.audio?.playExplosion();
    }

    this.time.delayedCall(success ? 1600 : 1200, () => {
      this.showMissionOverlay({
        success,
        reason: state.reason,
        time: state.time,
        fuelPercent,
        maxAltitude: this.maxAltitude || state.altitude,
        completedMissions,
      });
    });
  },

  // Objects created after the cameras exist must be hidden from the HUD and
  // backdrop cameras or they get drawn twice in screen space.
  addWorldObject(object) {
    this.uiCamera?.ignore(object);
    this.backdropCamera?.ignore(object);
    return object;
  },

  createExplosion() {
    this.cameras.main.shake(400, 0.012);
    const x = this.rocket.x;
    const y = this.rocket.y;
    const colors = [0xff4500, 0xff8c00, 0xffd700, 0xff6347, 0xffffff];
    this.rocket.setVisible(false);
    this.exhaust.clear();

    for (let i = 0; i < 35; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 8 + Math.random() * 26;
      const debris = this.addWorldObject(
        this.add
          .circle(x, y, 0.6 + Math.random() * 1.4, colors[i % colors.length], 1)
          .setDepth(30),
      );
      this.tweens.add({
        targets: debris,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 6,
        alpha: 0,
        scale: 0.2,
        duration: 600 + Math.random() * 800,
        ease: "Cubic.easeOut",
        onComplete: () => debris.destroy(),
      });
    }

    for (let i = 0; i < 16; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 4 + Math.random() * 14;
      const smoke = this.addWorldObject(
        this.add.circle(x, y, 1.5 + Math.random() * 2.5, 0x333333, 0.6).setDepth(29),
      );
      this.tweens.add({
        targets: smoke,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 12,
        alpha: 0,
        scale: 2 + Math.random() * 2,
        duration: 1000 + Math.random() * 1000,
        ease: "Quad.easeOut",
        onComplete: () => smoke.destroy(),
      });
    }

    const flash = this.addWorldObject(this.add.graphics().setDepth(31));
    flash.fillStyle(0xffffff, 0.8);
    flash.fillCircle(x, y, 16);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
  },

  updateCamera(state) {
    const renderPosition = getRenderPosition(state);
    if (state.orbitAchieved) {
      const minViewport = Math.min(this.scale.width, this.scale.height);
      const orbitRadius =
        FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude + 80;
      const desiredZoom = Phaser.Math.Clamp(
        (minViewport * 0.44) / orbitRadius * this.cameraState.zoomFactor,
        MIN_CAMERA_ZOOM,
        MAX_CAMERA_ZOOM,
      );

      this.cameraState.centerX = Phaser.Math.Linear(
        this.cameraState.centerX,
        this.cameraState.panX,
        0.08,
      );
      this.cameraState.centerY = Phaser.Math.Linear(
        this.cameraState.centerY,
        this.cameraState.panY,
        0.08,
      );
      this.cameraState.zoom = Phaser.Math.Linear(
        this.cameraState.zoom,
        desiredZoom,
        0.12,
      );
      this.cameras.main.centerOn(
        this.cameraState.centerX,
        this.cameraState.centerY,
      );
      this.cameras.main.setZoom(this.cameraState.zoom);
      return;
    }

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
    const mapViewProgress = this.getMapViewProgress();
    const framingY = Phaser.Math.Linear(28, 102, orbitBlend);
    const automaticZoom = Phaser.Math.Linear(
      INITIAL_CAMERA_ZOOM,
      orbitalZoom,
      orbitBlend,
    );
    const desiredCenterX = renderPosition.x + this.cameraState.panX;
    const launchSurfaceOffset = Phaser.Math.Linear(
      -6,
      LAUNCH_CAMERA_CENTER_OFFSET,
      mapViewProgress,
    );
    const launchCenterY =
      -FLIGHT_WORLD.planetRadius +
      launchSurfaceOffset +
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
    const cameraOverviewProgress = Math.max(
      overviewProgress,
      mapViewProgress,
    );
    const overviewCenterX = this.cameraState.panX;
    const overviewCenterY = this.cameraState.panY;
    const framedCenterX = Phaser.Math.Linear(
      desiredCenterX,
      overviewCenterX,
      cameraOverviewProgress,
    );
    const framedCenterY = Phaser.Math.Linear(
      desiredCenterY,
      overviewCenterY,
      cameraOverviewProgress,
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
    const mapViewProgress = this.getMapViewProgress();
    const solarViewProgress = Phaser.Math.Clamp(
      (0.22 - this.cameraState.zoomFactor) / 0.14,
      0,
      1,
    );
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
    const spaceProgress = Math.max(dayToSpace, mapViewProgress * 0.92);
    const orbitOverlayProgress = Math.max(overlayProgress, mapViewProgress);
    const planetAlpha = Math.max(
      0.92,
      Phaser.Math.Linear(0, Phaser.Math.Linear(0.9, 1, planetReveal), curvatureReveal),
      mapViewProgress,
    );
    const atmosphereAlpha = Math.max(
      0.28,
      Phaser.Math.Linear(0, Phaser.Math.Linear(1, 0.48, dayToSpace), curvatureReveal),
      mapViewProgress * 0.46,
    );
    const launchDetailAlpha = 1 - mapViewProgress;

    this.spaceShade.setAlpha(Phaser.Math.Linear(0, 0.96, spaceProgress));
    this.stars.forEach((star) => {
      star.setAlpha(Phaser.Math.Linear(0, 1, spaceProgress * spaceProgress));
    });

    this.orbitBand.setAlpha(Phaser.Math.Linear(0.02, 0.28, orbitOverlayProgress));
    this.orbitGuides.setAlpha(Phaser.Math.Linear(0.04, 0.56, orbitOverlayProgress));
    this.mapCelestialGraphics.setAlpha(solarViewProgress);
    this.planetBody.setAlpha(planetAlpha);
    this.planetAtmosphere.setAlpha(atmosphereAlpha);
    this.planetLight.setAlpha(0);
    this.horizonGlow.setAlpha(0);
    this.highAltitudeHorizon.setAlpha(0);
    this.atmosphereShell.setAlpha(0);
    this.launchBackdrop.setAlpha(
      Phaser.Math.Linear(0.9, 0, 1 - padFade) * launchDetailAlpha,
    );
    this.launchGround.setAlpha(
      Phaser.Math.Linear(1, 0, 1 - flatGroundFade) * launchDetailAlpha,
    );
    this.pad.setAlpha(padFade * 0.84 * launchDetailAlpha);
    this.launchTower.setAlpha(padFade * 0.9 * launchDetailAlpha);

    this.launchTowerGlow.clear();
    this.padGlow.clear();

    const cloudAlpha = Phaser.Math.Clamp(1 - state.altitude / 40, 0, 1) * 0.6 * launchDetailAlpha;
    this.cloudLayers.forEach((layer) => layer.graphics.setAlpha(cloudAlpha));

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

  // Dotted line showing where the rocket would coast with the engine off.
  updateTrajectory(state, prediction) {
    this.trajectoryGraphics.clear();
    this.maxAltitude = Math.max(this.maxAltitude || 0, state.altitude);

    if (state.altitude < GUIDANCE_REVEAL_ALTITUDE || prediction.points.length < 2) {
      return;
    }

    const color = prediction.impact ? 0xff9b8a : 0x73f7c0;
    const zoom = Math.max(this.cameras.main.zoom, 0.01);
    prediction.points.forEach((point, index) => {
      if (index % 2 !== 0) {
        return;
      }
      const fade = 1 - index / prediction.points.length;
      this.trajectoryGraphics.fillStyle(color, 0.2 + fade * 0.6);
      this.trajectoryGraphics.fillCircle(point.x, point.y, 2.2 / zoom);
    });
  },

  // Arrow from the rocket towards the heading the pilot should hold.
  updateGuidanceArrow(state) {
    const arrow = this.guidanceArrow;
    arrow.clear();

    if (this.finished || !state.launched || state.cutEngineCue || state.fuelRemaining <= 0.01) {
      return;
    }

    const zoom = Math.max(this.cameras.main.zoom, 0.01);
    const length = 74 / zoom;
    const angle = state.guidanceAngle + (state.arcAngle || 0);
    const aligned = Math.abs(state.guidanceError) < Phaser.Math.DegToRad(7);
    const color = aligned ? 0x73f7c0 : 0xffd166;
    const startX = this.rocket.x + Math.cos(angle) * (16 / zoom);
    const startY = this.rocket.y + Math.sin(angle) * (16 / zoom);
    const tipX = this.rocket.x + Math.cos(angle) * length;
    const tipY = this.rocket.y + Math.sin(angle) * length;
    const head = 14 / zoom;

    arrow.lineStyle(4 / zoom, color, 0.95);
    arrow.lineBetween(startX, startY, tipX, tipY);
    arrow.fillStyle(color, 0.95);
    arrow.fillTriangle(
      tipX + Math.cos(angle) * head,
      tipY + Math.sin(angle) * head,
      tipX + Math.cos(angle + 2.5) * head,
      tipY + Math.sin(angle + 2.5) * head,
      tipX + Math.cos(angle - 2.5) * head,
      tipY + Math.sin(angle - 2.5) * head,
    );
  },

  updateRocketPose(state) {
    const renderPosition = getRenderPosition(state);

    this.rocket.x = renderPosition.x;
    this.rocket.y = renderPosition.y;
    this.rocket.setScale(this.getRocketVisualScale());
    this.rocket.rotation = state.orientation + Math.PI / 2;
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
    const visualScale = this.getRocketVisualScale();
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
    if (this.getMapViewProgress() < 0.6) {
      this.updateLaunchParticles(state, delta / 1000);
    }

    if (flameLength <= 0) {
      return;
    }

    this.drawExhaustFlame(thrustVisual, flameLength * visualScale, visualScale);
  },

  drawExhaustFlame(thrustVisual, flameLength, visualScale = 1) {
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
    this.exhaust.fillCircle(rear.x, rear.y, (6 + thrustVisual * 4) * visualScale);
    this.exhaust.fillStyle(0xffe7a8, 0.42);
    this.exhaust.fillCircle(rear.x, rear.y, (12 + thrustVisual * 6) * visualScale);

    for (let index = 0; index < segmentCount; index += 1) {
      const t = index / (segmentCount - 1);
      const plumeOffset = flameLength * (0.14 + t * 0.82);
      const wobble =
        Math.sin(flickerTime + index * 1.35) * (1 - t) * (2.2 + thrustVisual * 2.8);
      const px = rear.x + plumeX * plumeOffset + lateralX * wobble;
      const py = rear.y + plumeY * plumeOffset + lateralY * wobble;
      const outerRadius =
        Phaser.Math.Linear(9 + thrustVisual * 4, 2.4, t) * visualScale;
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
    this.exhaust.fillCircle(tipX, tipY, (2 + thrustVisual * 1.2) * visualScale);
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
    const mobile =
      this.scale.width < 760 ||
      (this.scale.width < 920 && this.scale.height > this.scale.width * 1.15);
    const particleScale = mobile ? 0.58 : 1;
    const smokeCount = Math.round(Phaser.Math.Clamp((3 + intensity * 3) * particleScale, 2, 8));
    const fireCount = Math.round(Phaser.Math.Clamp((2 + intensity * 2.5) * particleScale, 1, 6));

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
