import Phaser from "phaser";
import MissionSystem from "../../systems/MissionSystem.js";
import { FLIGHT_PHASES, FLIGHT_WORLD } from "../../systems/FlightSimulator.js";
import {
  DAY_SKY_FADE_END_ALTITUDE,
  DAY_SKY_FADE_START_ALTITUDE,
  LAUNCH_PARTICLE_ALTITUDE,
  PAD_FADE_ALTITUDE,
  ROCKET_CELL_SIZE,
  TRAIL_LIMIT,
  TRAJECTORY_REVEAL_ALTITUDE,
} from "./FlightSceneConstants.js";
import {
  acquireParticle,
  fillDot,
  getRenderPosition,
  getThrustVisual,
  releaseParticle,
  toRenderSpace,
} from "./FlightSceneUtils.js";

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
    fillDot(flash, x, y, 16);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
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

  updateExhaust(state, time, delta) {
    const thrustVisual = getThrustVisual(state);
    const groundBoost = Phaser.Math.Clamp((80 - state.altitude) / 80, 0, 1);
    const speedFeel = Phaser.Math.Clamp(
      (Math.abs(state.verticalVelocity) + Math.abs(state.horizontalVelocity) * 0.25) / 1.3,
      0,
      1,
    );
    // Tuned for a 30-unit rocket; bigger rockets get a bigger flame, and
    // rockets with side boosters split it into several smaller ones.
    const flames = this.rocketDef.flames;
    const flameScale =
      Phaser.Math.Clamp(this.rocketHeight / 30, 0.7, 1.6) * (flames.length > 1 ? 0.36 : 0.5);
    const flameLength =
      thrustVisual > 0
        ? (34 +
            Math.sin(time / 55) * 5 +
            thrustVisual * 24 +
            groundBoost * thrustVisual * 22 +
            speedFeel * 14) *
          flameScale
        : 0;

    this.exhaust.clear();
    this.exhaustFire.clear();
    this.exhaustSmoke.clear();
    this.updateLaunchParticles(state, delta / 1000);

    if (flameLength <= 0) {
      return;
    }

    flames.forEach((offset) =>
      this.drawExhaustFlame(this.getExhaustAnchor(offset), thrustVisual, flameLength, flameScale),
    );
  },

  drawExhaustFlame(rear, thrustVisual, flameLength, scale) {
    const orientation = this.getVisualOrientation();
    const rearAngle = orientation + Math.PI / 2;
    const lateralX = Math.cos(rearAngle);
    const lateralY = Math.sin(rearAngle);
    const plumeX = -Math.cos(orientation);
    const plumeY = -Math.sin(orientation);
    const flickerTime = this.time.now * 0.045;
    const segmentCount = 7;

    this.exhaust.fillStyle(0xfff7d6, 0.98);
    fillDot(this.exhaust, rear.x, rear.y, (6 + thrustVisual * 4) * scale);
    this.exhaust.fillStyle(0xffe7a8, 0.42);
    fillDot(this.exhaust, rear.x, rear.y, (12 + thrustVisual * 6) * scale);

    for (let index = 0; index < segmentCount; index += 1) {
      const t = index / (segmentCount - 1);
      const plumeOffset = flameLength * (0.14 + t * 0.82);
      const wobble =
        Math.sin(flickerTime + index * 1.35) * (1 - t) * (2.2 + thrustVisual * 2.8) * scale;
      const px = rear.x + plumeX * plumeOffset + lateralX * wobble;
      const py = rear.y + plumeY * plumeOffset + lateralY * wobble;
      const outerRadius = Phaser.Math.Linear(9 + thrustVisual * 4, 2.4, t) * scale;
      const midRadius = outerRadius * Phaser.Math.Linear(0.76, 0.58, t);
      const coreRadius = outerRadius * Phaser.Math.Linear(0.42, 0.28, t);
      const alpha = Phaser.Math.Linear(0.72, 0.18, t);

      this.exhaust.fillStyle(0xff7b2f, alpha * 0.9);
      fillDot(this.exhaust, px, py, outerRadius);
      this.exhaust.fillStyle(0xffb347, alpha * 0.95);
      fillDot(
        this.exhaust,
        px - plumeX * outerRadius * 0.1,
        py - plumeY * outerRadius * 0.1,
        midRadius,
      );
      this.exhaust.fillStyle(0xfff2bf, Phaser.Math.Linear(0.8, 0.14, t));
      fillDot(
        this.exhaust,
        px - plumeX * outerRadius * 0.18,
        py - plumeY * outerRadius * 0.18,
        coreRadius,
      );
    }

    const tipX = rear.x + plumeX * (flameLength * 0.98);
    const tipY = rear.y + plumeY * (flameLength * 0.98);
    this.exhaust.fillStyle(0xff8c3b, 0.26);
    fillDot(this.exhaust, tipX, tipY, (2 + thrustVisual * 1.2) * scale);
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

      const spread = Phaser.Math.FloatBetween(-16, 16);
      particle.x = rear.x + lateralX * spread + Phaser.Math.FloatBetween(-6, 6);
      particle.y = rear.y + lateralY * spread + Phaser.Math.FloatBetween(-4, 8);
      particle.vx =
        exhaustX * Phaser.Math.FloatBetween(18, 58) +
        lateralX * Phaser.Math.FloatBetween(-30, 30);
      particle.vy =
        exhaustY * Phaser.Math.FloatBetween(26, 70) +
        lateralY * Phaser.Math.FloatBetween(-20, 20);
      particle.size = Phaser.Math.FloatBetween(4, 8);
      particle.growth = Phaser.Math.FloatBetween(8, 16);
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
      particle.size = Phaser.Math.FloatBetween(2, 4);
      particle.growth = Phaser.Math.FloatBetween(14, 28);
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
      fillDot(this.exhaustSmoke, particle.x, particle.y, particle.size);

      this.exhaustSmoke.fillStyle(midColor, alpha * 0.9);
      fillDot(
        this.exhaustSmoke,
        particle.x + particle.size * 0.06,
        particle.y + particle.size * 0.04,
        particle.size * 0.74,
      );

      this.exhaustSmoke.fillStyle(coreColor, alpha);
      fillDot(
        this.exhaustSmoke,
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
      fillDot(this.exhaustFire, particle.x, particle.y, particle.size * 1.2);

      this.exhaustFire.fillStyle(colorMid, alpha * 0.8);
      fillDot(this.exhaustFire, particle.x, particle.y, particle.size * 0.8);

      const offsetX = particle.vx * 0.02;
      const offsetY = particle.vy * 0.02;

      this.exhaustFire.fillStyle(colorCore, alpha);
      fillDot(
        this.exhaustFire,
        particle.x - offsetX,
        particle.y - offsetY,
        particle.size * 0.4,
      );
    }
  },
};
