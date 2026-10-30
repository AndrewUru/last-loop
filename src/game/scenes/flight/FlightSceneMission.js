import Phaser from "phaser";
import { MAX_Q_TOLERANCE, formatSpeed } from "../../data/rockets.js";
import FlightPredictor from "../../systems/FlightPredictor.js";
import { UI_FONT, formatSeconds } from "../../ui/theme.js";
import { FX_TEXTURES } from "./FlightSceneExhaust.js";
import { toRenderSpace } from "./FlightSceneUtils.js";

const RING_COLOR = 0x73f7c0;
const GOLD = 0xffd166;
const HAZARD_GLOW = 0xff5a4a;
// Fuel lost on each debris hit, as a share of a full tank.
const HAZARD_FUEL_COST = 0.1;
const CHIP_COLORS = {
  title: "#ffd166",
  info: "#f3f7fb",
  muted: "#9eb4ca",
  good: "#8ff5c4",
  warn: "#ffd166",
  bad: "#ff9b8a",
};

function distanceToSegment(point, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Phaser.Math.Clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t));
}

function halfEllipse(along, across, from, to) {
  return Array.from({ length: 17 }, (_, index) => {
    const angle = from + ((to - from) * index) / 16;
    return { x: Math.cos(angle) * along, y: Math.sin(angle) * across };
  });
}

// Everything a rocket's mission adds to a flight: rings and parts to pick up,
// debris to avoid, the Max-Q and single-burn rules, and the tracker under the
// HUD that shows how it is going.
export const flightSceneMissionMethods = {
  createMission() {
    const challenge = this.rocketDef.challenge;
    this.mission = { targets: [], hazards: [], targetsHit: 0, hazardsHit: 0, maxQSpeed: 0, engineLocked: false };
    this.missionObjects = [];

    if (challenge.targets || challenge.hazards) {
      this.climbPath = FlightPredictor.tracePath(this.stats);
    }
    if (challenge.targets) {
      const { kind, count } = challenge.targets;
      this.mission.targets = kind === "rings" ? this.createRings(count) : this.createParts(count);
    }
    if (challenge.hazards) {
      this.mission.hazards = this.createHazards(challenge.hazards);
    }
    this.createMissionTracker();
  },

  getMissionWorldObjects() {
    return this.missionObjects;
  },

  getMissionUiObjects() {
    return this.missionChips.map((chip) => chip.text);
  },

  // Spots along the perfect climb between two shares of its height, nudged
  // to alternate sides so the pilot has to steer a little for each one.
  // lift moves the spot from the rocket's base towards its nose: rings follow
  // the line the middle of the rocket takes, which drifts off the base's line
  // while the rocket is tilted.
  placeAlongClimb(count, from, to, spread, lift = 0) {
    const path = this.climbPath;
    const top = path[path.length - 1].altitude;
    const locate = (sample) => {
      const base = toRenderSpace(sample.position);
      return { x: base.x + Math.cos(sample.orientation) * lift, y: base.y + Math.sin(sample.orientation) * lift };
    };
    return Array.from({ length: count }, (_, index) => {
      const share = count === 1 ? (from + to) / 2 : from + ((to - from) * index) / (count - 1);
      const found = path.findIndex((sample) => sample.altitude >= top * share);
      const at = Phaser.Math.Clamp(found < 0 ? path.length - 2 : found, 0, path.length - 2);
      const point = locate(path[at]);
      const next = locate(path[at + 1]);
      const angle = Math.atan2(next.y - point.y, next.x - point.x);
      const side = (index % 2 === 0 ? 1 : -1) * spread;
      return { x: point.x - Math.sin(angle) * side, y: point.y + Math.cos(angle) * side, angle };
    });
  },

  addMissionObject(object) {
    this.missionObjects.push(object);
    return object;
  },

  // Hoops seen at an angle: the back half is drawn behind the rocket and the
  // front half in front of it, so the rocket flies through.
  createRings(count) {
    const radius = Math.max(this.rocketHeight * 0.45, 12);
    const thickness = Math.max(2.5, radius * 0.12);
    return this.placeAlongClimb(count, 0.12, 0.88, radius * 0.55, this.rocketHeight / 2).map((spot) => {
      const halves = [
        [Math.PI / 2, Math.PI * 1.5, 19.5],
        [-Math.PI / 2, Math.PI / 2, 21.5],
      ].map(([from, to, depth]) => {
        const graphics = this.add.graphics().setPosition(spot.x, spot.y).setRotation(spot.angle).setDepth(depth);
        const points = halfEllipse(radius * 0.32, radius, from, to);
        graphics.lineStyle(thickness * 2.4, RING_COLOR, 0.22);
        graphics.strokePoints(points, false);
        graphics.lineStyle(thickness, RING_COLOR, 1);
        graphics.strokePoints(points, false);
        return this.addMissionObject(graphics);
      });
      return { kind: "rings", x: spot.x, y: spot.y, radius, parts: halves, collected: false };
    });
  },

  // Telescope parts: a small satellite with two panels and a gold glow.
  createParts(count) {
    const size = Math.max(this.rocketWidth * 0.5, 5);
    const reach = size + this.rocketWidth * 0.35;
    return this.placeAlongClimb(count, 0.15, 0.85, reach * 0.6).map((spot) => {
      const glow = this.addMissionObject(
        this.add
          .image(spot.x, spot.y, FX_TEXTURES.glow)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(GOLD)
          .setDisplaySize(size * 5, size * 5)
          .setDepth(21),
      );
      const body = this.addMissionObject(this.add.graphics().setPosition(spot.x, spot.y).setDepth(21.5));
      body.fillStyle(0x2f6fd0, 1);
      body.fillRect(-size * 1.4, -size * 0.3, size * 0.9, size * 0.6);
      body.fillRect(size * 0.5, -size * 0.3, size * 0.9, size * 0.6);
      body.fillStyle(0xf2e6c4, 1);
      body.fillRect(-size * 0.45, -size * 0.45, size * 0.9, size * 0.9);
      body.lineStyle(Math.max(0.4, size * 0.08), 0x1b2430, 1);
      body.strokeRect(-size * 0.45, -size * 0.45, size * 0.9, size * 0.9);
      return { kind: "parts", x: spot.x, y: spot.y, radius: reach, parts: [glow, body], spin: body, collected: false };
    });
  },

  // Tumbling scrap with a red warning glow, sitting right on the climb path.
  createHazards(count) {
    const radius = Math.max(this.rocketWidth * 0.55, 6);
    return this.placeAlongClimb(count, 0.25, 0.92, radius * 0.3).map((spot) => {
      const glow = this.addMissionObject(
        this.add
          .image(spot.x, spot.y, FX_TEXTURES.glow)
          .setTint(HAZARD_GLOW)
          .setAlpha(0.35)
          .setDisplaySize(radius * 4, radius * 4)
          .setDepth(21),
      );
      const rock = this.addMissionObject(this.add.graphics().setPosition(spot.x, spot.y).setDepth(21.5));
      const outline = Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        const reach = radius * Phaser.Math.FloatBetween(0.7, 1);
        return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
      });
      rock.fillStyle(0x5a6068, 1);
      rock.fillPoints(outline, true);
      rock.fillStyle(0x7d848d, 1);
      rock.fillTriangle(outline[0].x, outline[0].y, outline[1].x, outline[1].y, 0, 0);
      rock.fillTriangle(outline[5].x, outline[5].y, outline[6].x, outline[6].y, 0, 0);
      rock.lineStyle(Math.max(0.5, radius * 0.08), 0x262a2f, 1);
      rock.strokePoints(outline, true);
      return {
        x: spot.x,
        y: spot.y,
        radius,
        parts: [glow, rock],
        spin: rock,
        spinRate: Phaser.Math.FloatBetween(-0.8, 0.8),
        hit: false,
      };
    });
  },

  // Counters the mission check needs once the flight ends.
  getMissionCounters() {
    const { targetsHit, hazardsHit, maxQSpeed } = this.mission;
    return { targetsHit, hazardsHit, maxQSpeed };
  },

  updateMission(state, delta) {
    const dt = delta / 1000;
    const challenge = this.rocketDef.challenge;
    const mission = this.mission;
    const rotation = this.rocket.rotation;
    const tail = { x: this.rocket.x, y: this.rocket.y };
    const nose = {
      x: tail.x + Math.sin(rotation) * this.rocketHeight,
      y: tail.y - Math.cos(rotation) * this.rocketHeight,
    };
    const middle = { x: (tail.x + nose.x) / 2, y: (tail.y + nose.y) / 2 };

    if (!this.finished) {
      mission.targets.forEach((target) => {
        if (target.collected) {
          return;
        }
        // Rings count when the middle of the rocket goes through; parts when
        // any of the body touches them.
        const distance =
          target.kind === "rings"
            ? Math.hypot(middle.x - target.x, middle.y - target.y)
            : distanceToSegment(target, tail, nose);
        if (distance < target.radius) {
          this.collectTarget(target);
        }
      });
      mission.hazards.forEach((hazard) => {
        if (!hazard.hit && distanceToSegment(hazard, tail, nose) < hazard.radius * 0.8 + this.rocketWidth * 0.3) {
          this.hitHazard(hazard, state);
        }
      });
      const band = challenge.maxQ;
      if (band && state.launched && state.altitude >= band.from && state.altitude <= band.to) {
        mission.maxQSpeed = Math.max(mission.maxQSpeed, state.speed);
      }
    }

    mission.targets.forEach((target) => target.spin?.setRotation(target.spin.rotation + dt * 0.8));
    mission.hazards.forEach((hazard) => hazard.spin.setRotation(hazard.spin.rotation + dt * hazard.spinRate));
    this.updateMissionTracker(state);
  },

  // Single-burn missions: once the engine is let go of in flight it stays off.
  // Letting go on the pad, before the clamps release, does not count.
  applyMissionControls(thrust) {
    if (!this.rocketDef.challenge.singleBurn) {
      return thrust;
    }
    const state = this.simulator.state;
    if (state.launched && !thrust) {
      this.mission.engineLocked = true;
      state.engineLocked = true;
    }
    return this.mission.engineLocked ? false : thrust;
  },

  collectTarget(target) {
    target.collected = true;
    this.mission.targetsHit += 1;
    this.audio?.playPlace?.();
    target.parts.forEach((part) =>
      this.tweens.add({
        targets: part,
        alpha: 0,
        scaleX: part.scaleX * 1.6,
        scaleY: part.scaleY * 1.6,
        duration: 450,
        ease: "Quad.easeOut",
      }),
    );
    const flashSize = target.radius * 3;
    const flash = this.addWorldObject(
      this.add
        .image(target.x, target.y, FX_TEXTURES.glow)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(GOLD)
        .setDepth(22)
        .setDisplaySize(flashSize, flashSize),
    );
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
  },

  // A hit throws sparks, shakes the camera and spills fuel.
  hitHazard(hazard, state) {
    hazard.hit = true;
    this.mission.hazardsHit += 1;
    state.fuelRemaining = Math.max(0, state.fuelRemaining - this.stats.fuel * HAZARD_FUEL_COST);
    this.cameras.main.shake(280, 0.01);
    this.audio?.playError?.();
    for (let index = 0; index < 14; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Phaser.Math.FloatBetween(20, 70) * this.exhaustScale;
      this.spawnParticle(
        this.fireParticles,
        this.firePool,
        {
          x: hazard.x,
          y: hazard.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1.5 * this.exhaustScale,
          endSize: 5 * this.exhaustScale,
          life: Phaser.Math.FloatBetween(0.25, 0.5),
          drag: 3,
          colorStart: 0xfff1c8,
          colorEnd: 0xff5a1a,
          alpha: 1,
        },
        true,
      );
    }
    this.tweens.add({ targets: hazard.parts, alpha: 0, duration: 350 });
  },

  // Replaces the HUD's usual instruction when the mission needs something
  // else from the pilot, or returns null.
  getMissionInstruction(state) {
    const band = this.rocketDef.challenge.maxQ;
    const inBand = band && state.launched && state.altitude >= band.from - 1 && state.altitude <= band.to;
    if (inBand && !state.result && state.speed > band.speed * 0.92) {
      return {
        title: "Max-Q: suelta el motor",
        body: `No pases de ${formatSpeed(band.speed)} hasta los ${band.to} km.`,
        tone: "warning",
      };
    }
    return null;
  },

  createMissionTracker() {
    const challenge = this.rocketDef.challenge;
    const kinds = ["title"];
    if (challenge.targets) kinds.push("targets");
    if (challenge.hazards) kinds.push("hazards");
    if (challenge.maxQ) kinds.push("maxQ");
    if (challenge.wind) kinds.push("wind");
    if (challenge.singleBurn) kinds.push("singleBurn");
    if (challenge.maxTime) kinds.push("time");
    if (challenge.minFuel) kinds.push("fuel");

    this.missionChips = kinds.map((kind) => ({
      kind,
      text: this.add
        .text(0, 0, "", {
          fontFamily: UI_FONT,
          fontSize: "13px",
          fontStyle: "bold",
          color: CHIP_COLORS.info,
          backgroundColor: "rgba(11,18,26,0.78)",
          padding: { x: 10, y: 5 },
        })
        .setScrollFactor(0)
        .setDepth(41),
    }));
  },

  describeChip(kind, state) {
    const challenge = this.rocketDef.challenge;
    const mission = this.mission;
    switch (kind) {
      case "title":
        return [`MISIÓN · ${challenge.title}`, "title"];
      case "targets": {
        const { kind: targetKind, count } = challenge.targets;
        const label = targetKind === "rings" ? "◎ Anillos" : "✦ Piezas";
        return [`${label} ${mission.targetsHit}/${count}`, mission.targetsHit >= count ? "good" : "info"];
      }
      case "hazards":
        return [`Choques ${mission.hazardsHit}`, mission.hazardsHit > 0 ? "bad" : "info"];
      case "maxQ": {
        const { from, to, speed } = challenge.maxQ;
        const over = mission.maxQSpeed > speed + MAX_Q_TOLERANCE;
        if (state.altitude < from) {
          return [`Max-Q de ${from} a ${to} km · máx. ${formatSpeed(speed)}`, "muted"];
        }
        if (state.altitude <= to && !over) {
          const now = state.speed.toFixed(1).replace(".", ",");
          return [`Max-Q ${now} / ${formatSpeed(speed)}`, state.speed > speed * 0.9 ? "warn" : "info"];
        }
        return over ? [`Max-Q ✖ ${formatSpeed(mission.maxQSpeed)}`, "bad"] : ["Max-Q superada ✓", "good"];
      }
      case "wind":
        return Math.abs(state.windGust) > 0.3
          ? [`Ráfaga ${state.windGust > 0 ? "▶" : "◀"}`, "warn"]
          : ["Viento fuerte", "muted"];
      case "singleBurn":
        if (!state.launched) {
          return ["Un solo encendido", "info"];
        }
        return mission.engineLocked ? ["Encendido usado", "muted"] : ["Motor encendido · no lo sueltes", "warn"];
      case "time": {
        const left = challenge.maxTime - state.time;
        return [`⏱ ${formatSeconds(state.time)} / ${challenge.maxTime} s`, left <= 0 ? "bad" : left < 10 ? "warn" : "info"];
      }
      case "fuel": {
        const percent = this.stats.fuel > 0 ? Math.round((state.fuelRemaining / this.stats.fuel) * 100) : 0;
        return [`Combustible ${percent}% · mín. ${challenge.minFuel}%`, percent < challenge.minFuel ? "bad" : "info"];
      }
      default:
        return ["", "info"];
    }
  },

  updateMissionTracker(state) {
    let changed = false;
    this.missionChips.forEach((chip) => {
      const [text, tone] = this.describeChip(chip.kind, state);
      if (chip.text.text !== text) {
        chip.text.setText(text);
        changed = true;
      }
      chip.text.setColor(CHIP_COLORS[tone]);
    });
    if (changed) {
      this.layoutMissionTracker();
    }
  },

  // A centred row of chips under the HUD panel, wrapping onto more rows on
  // narrow screens. The camera keeps the rocket below it.
  layoutMissionTracker() {
    const hud = this.hud.panelBounds;
    const { width } = this.scale;
    const gap = 6;
    const maxWidth = Math.min(width - 20, Math.max(hud.width, 600));
    const rows = [[]];
    let rowWidth = 0;
    this.missionChips.forEach((chip) => {
      const chipWidth = chip.text.width;
      if (rows[rows.length - 1].length > 0 && rowWidth + gap + chipWidth > maxWidth) {
        rows.push([]);
        rowWidth = 0;
      }
      rowWidth += (rowWidth > 0 ? gap : 0) + chipWidth;
      rows[rows.length - 1].push(chip);
    });

    let y = hud.y + hud.height + 8;
    rows.forEach((row) => {
      const total = row.reduce((sum, chip) => sum + chip.text.width, 0) + gap * (row.length - 1);
      let x = (width - total) / 2;
      row.forEach((chip) => {
        chip.text.setPosition(x, y);
        x += chip.text.width + gap;
      });
      y += row[0].text.height + gap;
    });
    this.missionTrackerBottom = y - gap;
  },
};
