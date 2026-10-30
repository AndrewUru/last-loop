import Phaser from "phaser";
import MissionSystem from "../../systems/MissionSystem.js";
import { FLIGHT_PHASES, FLIGHT_WORLD } from "../../systems/FlightSimulator.js";
import {
  DAY_SKY_FADE_END_ALTITUDE,
  DAY_SKY_FADE_START_ALTITUDE,
  PAD_FADE_ALTITUDE,
  ROCKET_CELL_SIZE,
  TRAIL_LIMIT,
  TRAJECTORY_REVEAL_ALTITUDE,
} from "./FlightSceneConstants.js";
import { fillDot, getRenderPosition, toRenderSpace } from "./FlightSceneUtils.js";

function smoothstep(value) {
  const t = Phaser.Math.Clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export const flightSceneRuntimeMethods = {
  // offset: across the rocket, from -0.5 (left edge) to 0.5 (right edge).
  getExhaustAnchor(offset = 0) {
    const localX = offset * this.rocketWidth;
    const localY = -this.rocketHeight * 0.015;
    const cos = Math.cos(this.rocket.rotation);
    const sin = Math.sin(this.rocket.rotation);

    return {
      x: this.rocket.x + localX * cos - localY * sin,
      y: this.rocket.y + localX * sin + localY * cos,
    };
  },

  getVisualOrientation() {
    return this.rocket.rotation - Math.PI / 2;
  },

  registerInput() {
    this.input.keyboard.on("keydown-ENTER", this.onResultPrimary);
    this.input.keyboard.on("keydown-ESC", this.onEscapeToHangar);
  },

  handleShutdown() {
    this.scale.off("resize", this.handleResize, this);
    this.input.keyboard.off("keydown-ENTER", this.onResultPrimary);
    this.input.keyboard.off("keydown-ESC", this.onEscapeToHangar);
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
    this.updateRocketPose(state);
    this.updateCamera(state);
    this.updateTrail(state);
    this.updateTrajectory(state, prediction);
    this.updateWorldVisuals(state);
    this.updateGuidanceArrow(state);
    this.updateExhaust(state, time, delta);
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
    // The state keeps ticking while the orbit settles, so freeze the time the
    // challenge is judged on and show that same number.
    const time = state.time;
    const challenge = MissionSystem.recordFlight({
      rocketId: this.rocketDef.id,
      success,
      fuelPercent,
      time,
    });

    if (state.failure === FLIGHT_PHASES.CRASHED) {
      this.createExplosion();
      this.audio?.playExplosion();
    }

    this.time.delayedCall(success ? 1600 : 1200, () => {
      this.showMissionOverlay({
        success,
        reason: state.reason,
        time,
        fuelPercent,
        maxAltitude: this.maxAltitude || state.altitude,
        challenge,
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
    this.extinguishExhaust();
    this.emitExplosion(x, y);

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
  },

  // Close-up on the pad, then a steady pull-back that keeps the rocket on
  // screen until the whole orbit fits, centred on the planet.
  updateCamera(state) {
    const { width, height } = this.scale;
    const minViewport = Math.min(width, height);
    const renderAltitude = Math.max(
      0,
      Math.hypot(this.rocket.x, this.rocket.y) - FLIGHT_WORLD.planetRadius,
    );
    const closeZoom = (minViewport * 0.3) / Math.max(this.rocketHeight, ROCKET_CELL_SIZE * 3);
    const orbitZoom =
      (minViewport * 0.44) /
      (FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude + 30);
    const pullBack = state.orbitAchieved
      ? 1
      : Math.sqrt(Phaser.Math.Clamp(renderAltitude / 210, 0, 1));
    const zoom = Math.exp(Phaser.Math.Linear(Math.log(closeZoom), Math.log(orbitZoom), pullBack));
    const towardsPlanet = state.orbitAchieved ? 1 : smoothstep((renderAltitude - 70) / 150);
    // On the pad the rocket sits a little below centre so the HUD never covers it.
    const hudLift = ((1 - towardsPlanet) * height * 0.08) / zoom;
    // Frame the free area below the HUD, not the whole screen, and never let
    // the rocket slide under the HUD panel or the touch buttons.
    const hud = this.hud.panelBounds;
    const safeTop = hud ? hud.y + hud.height + 28 : 60;
    const safeBottom = height - (this.touchControlsUi.visible ? 150 : 50);
    const anchorShift = ((safeTop + safeBottom) / 2 - height / 2) / zoom;
    let targetX = Phaser.Math.Linear(this.rocket.x, 0, towardsPlanet);
    let targetY = Phaser.Math.Linear(this.rocket.y - hudLift, 0, towardsPlanet) - anchorShift;
    const safeSide = Math.min(60, width * 0.1);
    const screenX = (this.rocket.x - targetX) * zoom + width / 2;
    const screenY = (this.rocket.y - targetY) * zoom + height / 2;
    if (screenY < safeTop) {
      targetY -= (safeTop - screenY) / zoom;
    } else if (screenY > safeBottom) {
      targetY += (screenY - safeBottom) / zoom;
    }
    if (screenX < safeSide) {
      targetX -= (safeSide - screenX) / zoom;
    } else if (screenX > width - safeSide) {
      targetX += (screenX - (width - safeSide)) / zoom;
    }

    const camera = this.cameraState;

    if (!camera.initialized) {
      Object.assign(camera, { initialized: true, x: targetX, y: targetY, zoom });
    } else {
      camera.x = Phaser.Math.Linear(camera.x, targetX, 0.18);
      camera.y = Phaser.Math.Linear(camera.y, targetY, 0.18);
      camera.zoom = Phaser.Math.Linear(camera.zoom, zoom, 0.12);
    }

    this.cameras.main.setZoom(camera.zoom);
    this.cameras.main.centerOn(camera.x, camera.y);
  },

  updateWorldVisuals(state) {
    const spaceProgress = Phaser.Math.Clamp(
      (state.altitude - DAY_SKY_FADE_START_ALTITUDE) /
        (DAY_SKY_FADE_END_ALTITUDE - DAY_SKY_FADE_START_ALTITUDE),
      0,
      1,
    );
    const guideProgress = Phaser.Math.Clamp((state.altitude - 30) / 90, 0, 1);
    const padFade = Phaser.Math.Clamp(1 - state.altitude / PAD_FADE_ALTITUDE, 0, 1);
    const cloudAlpha = Phaser.Math.Clamp(1 - state.altitude / 40, 0, 1) * 0.6;

    this.spaceShade.setAlpha(spaceProgress * 0.96);
    const starAlpha = spaceProgress * spaceProgress;
    this.stars.forEach((star) => star.setAlpha(starAlpha));
    this.orbitGuides.setAlpha(0.2 + guideProgress * 0.8);
    this.pad.setAlpha(padFade);
    this.cloudLayers.forEach((layer) => layer.graphics.setAlpha(cloudAlpha));
  },

  updateTrail(state) {
    if (!state.launched) {
      return;
    }

    const last = this.flightTrail[this.flightTrail.length - 1];
    if (!last || state.time - last.time >= 0.25) {
      this.flightTrail.push({ x: this.rocket.x, y: this.rocket.y, time: state.time });
      if (this.flightTrail.length > TRAIL_LIMIT) {
        this.flightTrail.shift();
      }
    }

    this.trailGraphics.clear();
    if (this.flightTrail.length < 2) {
      return;
    }

    this.trailGraphics.lineStyle(2 / this.cameras.main.zoom, 0xffd773, 0.55);
    this.trailGraphics.beginPath();
    this.trailGraphics.moveTo(this.flightTrail[0].x, this.flightTrail[0].y);
    for (let index = 1; index < this.flightTrail.length; index += 1) {
      this.trailGraphics.lineTo(this.flightTrail[index].x, this.flightTrail[index].y);
    }
    this.trailGraphics.lineTo(this.rocket.x, this.rocket.y);
    this.trailGraphics.strokePath();
  },

  // Dotted line showing where the rocket would coast with the engine off:
  // green if it stays up, red if it falls back to the ground.
  updateTrajectory(state, prediction) {
    this.trajectoryGraphics.clear();
    this.maxAltitude = Math.max(this.maxAltitude || 0, state.altitude);

    if (
      this.finished ||
      state.altitude < TRAJECTORY_REVEAL_ALTITUDE ||
      prediction.points.length < 2
    ) {
      return;
    }

    const color = prediction.impact ? 0xff9b8a : 0x73f7c0;
    const radius = 2.4 / this.cameras.main.zoom;
    prediction.points.forEach((point, index) => {
      if (index % 2 !== 0) {
        return;
      }
      const fade = 1 - index / prediction.points.length;
      const renderPoint = toRenderSpace(point);
      this.trajectoryGraphics.fillStyle(color, 0.2 + fade * 0.6);
      fillDot(this.trajectoryGraphics, renderPoint.x, renderPoint.y, radius);
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
    const angle = state.guidanceAngle + (state.arcAngle || 0);
    const aligned = Math.abs(state.guidanceError) < Phaser.Math.DegToRad(7);
    const color = aligned ? 0x73f7c0 : 0xffd166;
    const centerX = this.rocket.x + Math.cos(this.getVisualOrientation()) * (this.rocketHeight / 2);
    const centerY = this.rocket.y + Math.sin(this.getVisualOrientation()) * (this.rocketHeight / 2);
    const start = this.rocketHeight * 0.65 + 6 / zoom;
    const length = start + 70 / zoom;
    const head = 14 / zoom;
    const tipX = centerX + Math.cos(angle) * length;
    const tipY = centerY + Math.sin(angle) * length;

    arrow.lineStyle(4 / zoom, color, 0.95);
    arrow.lineBetween(
      centerX + Math.cos(angle) * start,
      centerY + Math.sin(angle) * start,
      tipX,
      tipY,
    );
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
    this.rocket.rotation = state.orientation + Math.PI / 2;
  },
};
