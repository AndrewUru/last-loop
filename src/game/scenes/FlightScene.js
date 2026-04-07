import Phaser from "phaser";
import ShipPart from "../entities/ShipPart.js";
import ShipStatsCalculator from "../systems/ShipStatsCalculator.js";
import FlightSimulator, {
  FLIGHT_TARGETS,
  FLIGHT_WORLD,
} from "../systems/FlightSimulator.js";
import { PARTS_BY_ID } from "../data/parts.js";

function angleDifference(target, current) {
  let delta = target - current;

  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }

  return delta;
}

export default class FlightScene extends Phaser.Scene {
  constructor() {
    super({ key: "FlightScene" });
  }

  init(data) {
    this.build = data.build || this.registry.get("rocket-build") || [];
    this.stats = data.stats || ShipStatsCalculator.calculate(this.build);
  }

  create() {
    this.simulator = new FlightSimulator(this.stats);
    this.finished = false;
    this.flightTrail = [];
    this.smokeTrail = [];
    this.input.mouse?.disableContextMenu();
    this.controls = {
      cruiseThrottle: 0.84,
      throttle: 0,
      engineOn: false,
      steer: 0,
      source: "Pad",
    };
    this.flightKeys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      f: Phaser.Input.Keyboard.KeyCodes.F,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    });

    this.createSpaceBackdrop();
    this.createOrbitalWorld();
    this.createRocket();
    this.createHud();

    this.cameras.main.centerOn(0, 0);
    this.cameras.main.setZoom(1.2);

    this.input.keyboard.on("keydown-ESC", () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => {
        this.scene.start("BuildScene", { build: this.build });
      });
    });
  }

  createSpaceBackdrop() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#020712");

    this.nebula = this.add.graphics().setScrollFactor(0).setDepth(-100);
    this.nebula.fillGradientStyle(0x020712, 0x081726, 0x040a12, 0x02050a, 1);
    this.nebula.fillRect(-width, -height, width * 3, height * 3);
    this.nebula.fillStyle(0x19456b, 0.12);
    this.nebula.fillCircle(width * 0.78, height * 0.22, 180);
    this.nebula.fillStyle(0xff8e54, 0.08);
    this.nebula.fillCircle(width * 0.25, height * 0.78, 220);

    this.stars = Array.from({ length: 120 }, () =>
      this.add
        .circle(
          Phaser.Math.Between(-width, width * 2),
          Phaser.Math.Between(-height, height * 2),
          Phaser.Math.FloatBetween(1, 2.8),
          Phaser.Math.Between(0xb8daff, 0xffffff),
          Phaser.Math.FloatBetween(0.18, 0.8),
        )
        .setScrollFactor(0.05)
        .setDepth(-90),
    );
  }

  createOrbitalWorld() {
    this.orbitGraphics = this.add.graphics().setDepth(-20);
    this.trailGraphics = this.add.graphics().setDepth(11);
    this.planetAtmosphere = this.add.graphics().setDepth(-18);
    this.planetBody = this.add.graphics().setDepth(-17);
    this.planetDetails = this.add.graphics().setDepth(-16);
    this.launchMarker = this.add.graphics().setDepth(-15);

    this.drawPlanet();
    this.drawOrbitGuides();
  }

  drawPlanet() {
    const radius = FLIGHT_WORLD.planetRadius;

    this.planetAtmosphere.clear();
    this.planetAtmosphere.fillStyle(0x4fc3ff, 0.08);
    this.planetAtmosphere.fillCircle(
      0,
      0,
      radius + FLIGHT_WORLD.atmosphereHeight + 16,
    );
    this.planetAtmosphere.lineStyle(3, 0x6fd4ff, 0.28);
    this.planetAtmosphere.strokeCircle(
      0,
      0,
      radius + FLIGHT_WORLD.atmosphereHeight,
    );

    this.planetBody.clear();
    this.planetBody.fillStyle(0x0d2840, 1);
    this.planetBody.fillCircle(0, 0, radius);
    this.planetBody.fillStyle(0x143f61, 1);
    this.planetBody.fillCircle(-34, -42, radius * 0.82);

    this.planetDetails.clear();
    this.planetDetails.fillStyle(0x1c644b, 0.85);
    this.planetDetails.fillEllipse(-42, -18, 120, 68);
    this.planetDetails.fillEllipse(58, 36, 132, 78);
    this.planetDetails.fillStyle(0xffffff, 0.16);
    this.planetDetails.fillCircle(-70, -82, 42);

    this.launchMarker.clear();
    this.launchMarker.fillStyle(0xffd773, 1);
    this.launchMarker.fillTriangle(
      -10,
      -radius - 2,
      10,
      -radius - 2,
      0,
      -radius - 18,
    );
  }

  drawOrbitGuides() {
    const targetRadius =
      FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude;
    const escapeRadius =
      FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.earthEscapeAltitude;

    this.orbitGraphics.clear();
    this.orbitGraphics.lineStyle(2, 0x68d9ff, 0.22);
    this.orbitGraphics.strokeCircle(
      0,
      0,
      FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.atmosphereHeight,
    );
    this.orbitGraphics.lineStyle(3, 0x73f7c0, 0.34);
    this.orbitGraphics.strokeCircle(0, 0, targetRadius);
    this.orbitGraphics.lineStyle(2, 0xffd98a, 0.25);
    this.orbitGraphics.strokeCircle(0, 0, escapeRadius);
    this.orbitGraphics.lineStyle(1, 0xffffff, 0.1);
    this.orbitGraphics.strokeCircle(0, 0, targetRadius - 28);
    this.orbitGraphics.strokeCircle(0, 0, targetRadius + 28);
  }

  createRocket() {
    const bounds = this.stats.bounds || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const cellSize = 56;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = bounds.maxY;

    this.rocket = this.add.container(0, 0).setDepth(15);
    this.exhaustSmoke = this.add.graphics().setDepth(13);
    this.exhaust = this.add.graphics().setDepth(14);

    this.build.forEach((part) => {
      const definition = PARTS_BY_ID[part.partId];
      const sprite = new ShipPart(
        this,
        (part.cellX + definition.gridWidth / 2 - centerX) * cellSize,
        (part.cellY + definition.gridHeight / 2 - centerY) * cellSize,
        definition,
        {
          cellSize,
          padding: 8,
          showLabel: false,
          showPlate: false,
        },
      );
      this.rocket.add(sprite);
    });
  }

  createHud() {
    // Left HUD shadow
    this.add
      .rectangle(192, 186, 316, 306, 0x000000, 0.3)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68d9ff, 0.1)
      .setDepth(39);

    this.leftHud = this.add
      .rectangle(190, 184, 316, 306, 0x081624, 0.95)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68d9ff, 0.35)
      .setDepth(40);
    this.add
      .text(48, 40, "Orbital Telemetry", {
        fontSize: "30px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(41);
    this.add
      .text(
        48,
        78,
        "F or button: engine on/off  A/D steer  W/S throttle  Hold click/Shift to burn  ESC returns",
        {
          fontSize: "15px",
          color: "#8fd7ff",
          wordWrap: { width: 280 },
        },
      )
      .setScrollFactor(0)
      .setDepth(41);
    this.metricsText = this.add
      .text(48, 126, "", {
        fontSize: "17px",
        color: "#d8f7ff",
        lineSpacing: 9,
      })
      .setScrollFactor(0)
      .setDepth(41);

    // Right HUD shadow
    this.add
      .rectangle(this.scale.width - 188, 186, 316, 306, 0x000000, 0.3)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68d9ff, 0.1)
      .setDepth(39);

    this.rightHud = this.add
      .rectangle(this.scale.width - 190, 184, 316, 306, 0x081624, 0.95)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68d9ff, 0.35)
      .setDepth(40);
    this.progressText = this.add
      .text(this.scale.width - 334, 40, "", {
        fontSize: "17px",
        color: "#d8f7ff",
        lineSpacing: 9,
        wordWrap: { width: 280 },
      })
      .setScrollFactor(0)
      .setDepth(41);

    // Engine button shadow
    this.add
      .rectangle(192, 356, 240, 52, 0x000000, 0.25)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x73f7c0, 0.1)
      .setDepth(41)
      .setInteractive({ useHandCursor: true });

    this.engineButton = this.add
      .rectangle(190, 354, 240, 52, 0x163248, 0.96)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x73f7c0, 0.6)
      .setDepth(42)
      .setInteractive({ useHandCursor: true });
    this.engineButtonLabel = this.add
      .text(190, 354, "Ignite Engine", {
        fontSize: "20px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(43);

    this.engineButton.on("pointerdown", () => {
      this.toggleEngine();
    });
    this.engineButton.on("pointerover", () => {
      this.engineButton.setStrokeStyle(2, 0x73f7c0, 1);
    });
    this.engineButton.on("pointerout", () => {
      this.updateEngineButton(this.simulator.state);
    });
  }

  update(time, delta) {
    this.updatePilotControls(delta);
    const state = this.simulator.update(delta, this.controls);

    this.updateTrail(state);
    this.updateCamera(state);
    this.updateStars(state);
    this.updateRocketPose(state);
    this.updateExhaust(state, time, delta);
    this.updateHud(state);
    this.updateEngineButton(state);

    if (!this.finished && state.result) {
      this.finished = true;
      if (state.result === "success") {
        this.cameras.main.fadeOut(900, 0, 0, 0);
        this.time.delayedCall(920, () => {
          this.scene.start("DeepSpaceScene", {
            build: this.build,
            stats: this.stats,
            departure: {
              altitude: state.altitude,
              horizontalVelocity: Math.abs(state.tangentialVelocity),
              time: state.time,
            },
          });
        });
      } else {
        this.time.delayedCall(1200, () => {
          this.scene.start("ResultScene", {
            build: this.build,
            stats: this.stats,
            result: state.result,
            reason: state.reason,
            altitude: state.altitude,
            horizontalVelocity: Math.abs(state.tangentialVelocity),
            time: state.time,
          });
        });
      }
    }
  }

  updateTrail(state) {
    if (!state.launched && this.flightTrail.length === 0) {
      return;
    }

    this.flightTrail.push({
      x: state.position.x,
      y: state.position.y,
    });

    if (this.flightTrail.length > 260) {
      this.flightTrail.shift();
    }

    this.trailGraphics.clear();
    if (this.flightTrail.length < 2) {
      return;
    }

    this.trailGraphics.lineStyle(3, 0xffd773, 0.55);
    this.trailGraphics.beginPath();
    this.trailGraphics.moveTo(this.flightTrail[0].x, this.flightTrail[0].y);
    for (let index = 1; index < this.flightTrail.length; index += 1) {
      this.trailGraphics.lineTo(
        this.flightTrail[index].x,
        this.flightTrail[index].y,
      );
    }
    this.trailGraphics.strokePath();
  }

  updateCamera(state) {
    const minViewport = Math.min(this.scale.width, this.scale.height);
    const targetViewRadius = Math.max(
      FLIGHT_WORLD.planetRadius + 120,
      Phaser.Math.Linear(
        FLIGHT_WORLD.planetRadius + 120,
        FLIGHT_WORLD.planetRadius + FLIGHT_WORLD.targetOrbitAltitude + 90,
        Phaser.Math.Clamp(
          state.altitude / FLIGHT_WORLD.targetOrbitAltitude,
          0,
          1,
        ),
      ),
      state.radius + 70,
    );
    const targetZoom = Phaser.Math.Clamp(
      (minViewport * 0.45) / targetViewRadius,
      0.34,
      1.52,
    );

    this.cameras.main.centerOn(0, 0);
    this.cameras.main.zoom = Phaser.Math.Linear(
      this.cameras.main.zoom,
      targetZoom,
      0.08,
    );
  }

  updateStars(state) {
    const altitudeProgress = Phaser.Math.Clamp(
      state.altitude / FLIGHT_WORLD.targetOrbitAltitude,
      0,
      1,
    );

    this.stars.forEach((star, index) => {
      star.alpha = 0.2 + altitudeProgress * 0.9;
      star.scale = 0.8 + altitudeProgress * 0.5 + (index % 5) * 0.03;
    });
  }

  updateRocketPose(state) {
    this.rocket.x = state.position.x;
    this.rocket.y = state.position.y;
    this.rocket.rotation = state.orientation + Math.PI / 2;
  }

  updateExhaust(state, time, delta) {
    const engineCount = Math.max(
      this.stats.engineCount + this.stats.boosterCount,
      1,
    );
    const thrustVisual =
      state.engineOn && state.fuelRemaining > 0 ? state.throttle : 0;
    const flameLength =
      thrustVisual > 0
        ? 20 + engineCount * 9 + Math.sin(time / 65) * 6 + thrustVisual * 16
        : 0;

    this.exhaust.clear();
    this.exhaustSmoke.clear();

    this.updateSmokeTrail(state, delta);

    if (flameLength <= 0) {
      return;
    }

    const rearAngle = state.orientation + Math.PI / 2;
    const rearX = state.position.x - Math.cos(state.orientation) * 30;
    const rearY = state.position.y - Math.sin(state.orientation) * 30;
    const sideX = Math.cos(rearAngle) * 11;
    const sideY = Math.sin(rearAngle) * 11;
    const tailX = rearX - Math.cos(state.orientation) * flameLength;
    const tailY = rearY - Math.sin(state.orientation) * flameLength;

    this.exhaust.fillStyle(0xfff4bf, 0.95);
    this.exhaust.fillCircle(rearX, rearY, 10 + thrustVisual * 6);
    this.exhaust.fillStyle(0xffc56e, 0.85);
    this.exhaust.fillCircle(tailX, tailY, 5 + thrustVisual * 4);

    this.exhaust.fillStyle(0xfff0aa, 0.92);
    this.exhaust.fillTriangle(
      rearX + sideX,
      rearY + sideY,
      rearX - sideX,
      rearY - sideY,
      tailX,
      tailY,
    );
    this.exhaust.fillStyle(0xffb057, 0.82);
    this.exhaust.fillTriangle(
      rearX + sideX * 1.55,
      rearY + sideY * 1.55,
      rearX - sideX * 1.55,
      rearY - sideY * 1.55,
      tailX - Math.cos(state.orientation) * (16 + thrustVisual * 20),
      tailY - Math.sin(state.orientation) * (16 + thrustVisual * 20),
    );
    this.exhaust.fillStyle(0xff7d38, 0.58);
    this.exhaust.fillTriangle(
      rearX + sideX * 2.15,
      rearY + sideY * 2.15,
      rearX - sideX * 2.15,
      rearY - sideY * 2.15,
      tailX - Math.cos(state.orientation) * (34 + thrustVisual * 26),
      tailY - Math.sin(state.orientation) * (34 + thrustVisual * 26),
    );
  }

  updateHud(state) {
    const fuelPct =
      this.stats.fuel > 0 ? (state.fuelRemaining / this.stats.fuel) * 100 : 0;

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
      ].join("\n"),
    );

    this.progressText.setText(
      [
        "Mission Goal",
        `Orbit altitude: ${FLIGHT_WORLD.targetOrbitAltitude} km`,
        `Target orbital speed: ${FLIGHT_TARGETS.orbitalVelocity.toFixed(2)} km/s`,
        `Earth departure altitude: ${FLIGHT_WORLD.earthEscapeAltitude} km`,
        `Orbit lock: ${state.orbitHoldTime.toFixed(1)} / ${FLIGHT_WORLD.orbitLockDuration}s`,
        `Escape progress: ${Math.round(state.escapeProgress * 100)}%`,
        `Apoapsis: ${state.apoapsis.toFixed(1)} km`,
        `Periapsis: ${state.periapsis.toFixed(1)} km`,
        `Pilot input: ${this.controls.source}`,
        state.reason
          ? `Status: ${state.reason}`
          : state.engineOn
            ? state.orbitAchieved
              ? "Status: keep burning until the ship leaves Earth orbit"
              : "Status: capture orbit first, then push outward"
            : "Status: ignite the engine to leave the launch pad",
      ].join("\n"),
    );
  }

  updatePilotControls(delta) {
    const leftPressed = this.flightKeys.left.isDown || this.flightKeys.a.isDown;
    const rightPressed =
      this.flightKeys.right.isDown || this.flightKeys.d.isDown;
    const upPressed = this.flightKeys.up.isDown || this.flightKeys.w.isDown;
    const downPressed = this.flightKeys.down.isDown || this.flightKeys.s.isDown;
    const keyboardSteer = (rightPressed ? 1 : 0) - (leftPressed ? 1 : 0);
    const pointer = this.input.activePointer;

    if (
      Phaser.Input.Keyboard.JustDown(this.flightKeys.f) ||
      Phaser.Input.Keyboard.JustDown(this.flightKeys.space)
    ) {
      this.toggleEngine();
    }

    if (upPressed) {
      this.controls.cruiseThrottle = Math.min(
        1,
        this.controls.cruiseThrottle + delta * 0.0009,
      );
    }
    if (downPressed) {
      this.controls.cruiseThrottle = Math.max(
        0.18,
        this.controls.cruiseThrottle - delta * 0.0009,
      );
    }

    this.controls.throttle = this.controls.engineOn
      ? pointer.isDown || this.flightKeys.shift.isDown
        ? 1
        : this.controls.cruiseThrottle
      : 0;

    if (keyboardSteer !== 0) {
      this.controls.steer = keyboardSteer;
      this.controls.source = this.controls.engineOn ? "Keyboard" : "Pad";
      return;
    }

    const rocketWorld = this.simulator.state.position;
    const mouseWorldX = pointer.worldX;
    const mouseWorldY = pointer.worldY;
    const aimAngle = Math.atan2(
      mouseWorldY - rocketWorld.y,
      mouseWorldX - rocketWorld.x,
    );
    const aimDelta = angleDifference(
      aimAngle,
      this.simulator.state.orientation,
    );

    if (pointer.x > 0 && pointer.y > 0 && this.controls.engineOn) {
      this.controls.steer = Phaser.Math.Clamp(aimDelta / 0.65, -1, 1);
      this.controls.source = pointer.isDown ? "Mouse + Burn" : "Mouse";
      return;
    }

    this.controls.steer = 0;
    this.controls.source = this.controls.engineOn ? "Stable" : "Pad";
  }

  toggleEngine() {
    this.controls.engineOn = !this.controls.engineOn;
  }

  updateEngineButton(state) {
    const isOn = state?.engineOn ?? this.controls.engineOn;
    const fillColor = isOn ? 0x5b1f1f : 0x163248;
    const strokeColor = isOn ? 0xff9b7a : 0x73f7c0;
    const label = isOn ? "Shutdown Engine" : "Ignite Engine";

    this.engineButton.setFillStyle(fillColor, 0.96);
    this.engineButton.setStrokeStyle(2, strokeColor, 0.7);
    this.engineButtonLabel.setText(label);
  }

  updateSmokeTrail(state, delta) {
    const lifeStep = delta / 1000;
    const thrustVisual =
      state.engineOn && state.fuelRemaining > 0 ? state.throttle : 0;
    const rearX = state.position.x - Math.cos(state.orientation) * 28;
    const rearY = state.position.y - Math.sin(state.orientation) * 28;
    const smokeAmount = Math.round(
      Phaser.Math.Clamp(
        thrustVisual * (0.8 + state.atmosphereDensity * 2.8),
        0,
        4,
      ),
    );

    for (let index = 0; index < smokeAmount; index += 1) {
      const spread = Phaser.Math.FloatBetween(-0.28, 0.28);
      const speed = Phaser.Math.FloatBetween(18, 40) * (0.7 + state.throttle);
      this.smokeTrail.push({
        x: rearX + Phaser.Math.Between(-4, 4),
        y: rearY + Phaser.Math.Between(-4, 4),
        vx:
          -Math.cos(state.orientation + spread) * speed * 0.05 +
          Phaser.Math.FloatBetween(-0.22, 0.22),
        vy:
          -Math.sin(state.orientation + spread) * speed * 0.05 +
          Phaser.Math.FloatBetween(-0.22, 0.22),
        size: Phaser.Math.FloatBetween(8, 13),
        growth: Phaser.Math.FloatBetween(18, 28),
        life:
          Phaser.Math.FloatBetween(0.35, 0.85) *
          (0.65 + state.atmosphereDensity),
        maxLife: 1,
        heat: Phaser.Math.FloatBetween(0.15, 0.55),
      });
    }

    this.smokeTrail = this.smokeTrail.filter((puff) => {
      puff.life -= lifeStep;
      puff.x += puff.vx;
      puff.y += puff.vy;
      puff.size += puff.growth * lifeStep;

      if (puff.life <= 0) {
        return false;
      }

      const alpha = Phaser.Math.Clamp(puff.life / puff.maxLife, 0, 1);
      const heatColor = puff.heat > 0.35 ? 0xffb17a : 0xb9c4cf;

      this.exhaustSmoke.fillStyle(heatColor, alpha * 0.14);
      this.exhaustSmoke.fillCircle(puff.x, puff.y, puff.size);
      this.exhaustSmoke.fillStyle(0x55616d, alpha * 0.22);
      this.exhaustSmoke.fillCircle(puff.x, puff.y, puff.size * 0.78);
      return true;
    });
  }
}
