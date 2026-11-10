import Phaser from "phaser";
import { ART } from "../../data/art.js";
import { FLIGHT_WORLD } from "../../systems/FlightSimulator.js";

// The launch site around the pad: land instead of open water, distant ridges
// and a treeline for depth, a haze that blends the horizon into the sky, a
// concrete apron with a flame trench, lightning masts and, at night,
// floodlights. Everything is drawn once in world units (the rocket height is
// the unit) and fades out with the pad as the rocket climbs.

// Palettes per mission sky.
const SITE_PALETTES = {
  day: {
    land: 0x8c7d3c, landEdge: 0xa8964c, landDeep: 0x6b5d2a,
    ridgeFar: 0x9cc3d6, ridgeNear: 0x6f98ad, trees: 0x4f5a2a,
    haze: 0xd4f0ff, concrete: 0xb6bfc6, concreteDark: 0x7d8890, steel: 0x59636d,
    road: 0x8f9396,
  },
  storm: {
    land: 0x55664a, landEdge: 0x6f805d, landDeep: 0x3d4b36,
    ridgeFar: 0x8a97a5, ridgeNear: 0x6b7987, trees: 0x34452f,
    haze: 0xb7c3cf, concrete: 0x9aa3aa, concreteDark: 0x687179, steel: 0x4d555d,
    road: 0x767b80,
  },
  night: {
    land: 0x18262a, landEdge: 0x24363a, landDeep: 0x101b1e,
    ridgeFar: 0x223650, ridgeNear: 0x1a2a3e, trees: 0x0f1a1c,
    haze: 0x2f4f72, concrete: 0x56606a, concreteDark: 0x353d45, steel: 0x2b3238,
    road: 0x3a4046,
  },
};
// Water far beyond the coast, as on the real launch sites.
const OCEAN = 0x1f5f8e;

function mixColor(from, to, t) {
  const a = Phaser.Display.Color.IntegerToColor(from);
  const b = Phaser.Display.Color.IntegerToColor(to);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 1000, Math.round(Phaser.Math.Clamp(t, 0, 1) * 1000));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

// Deterministic noise so the ridges look the same on every launch.
function ridgeNoise(x, seed) {
  return (
    Math.sin(x * 0.9 + seed) * 0.5 +
    Math.sin(x * 2.3 + seed * 1.7) * 0.3 +
    Math.sin(x * 5.1 + seed * 0.3) * 0.2
  );
}

export const flightSceneLaunchSiteMethods = {
  getSitePalette() {
    const { night, wind } = this.rocketDef.challenge;
    return SITE_PALETTES[night ? "night" : wind ? "storm" : "day"];
  },

  // The flat planet body takes the colour of land near the pad and turns into
  // ocean as it curves into the globe.
  getPlanetSurfaceColor(reveal) {
    const palette = this.getSitePalette?.() || SITE_PALETTES.day;
    return mixColor(palette.land, OCEAN, Phaser.Math.Clamp(reveal * 1.4, 0, 1));
  },

  createLaunchSite() {
    const u = this.rocketHeight;
    const S = -FLIGHT_WORLD.planetRadius;
    const p = this.getSitePalette();
    const night = Boolean(this.rocketDef.challenge.night);
    const span = 40 * u;
    // The painted panorama replaces the drawn ridges, treeline and towers.
    const panorama = this.textures.exists(ART.coastPanorama.key);

    // --- far: ridges and haze, behind the low clouds ---
    this.siteFar = this.add.graphics().setDepth(-10);
    const ridge = (g, color, height, seed, step) => {
      const points = [{ x: -span, y: S }];
      for (let x = -span; x <= span; x += step) {
        const h = height * (0.55 + 0.45 * ridgeNoise(x / u, seed));
        points.push({ x, y: S - h });
      }
      points.push({ x: span, y: S });
      g.fillStyle(color, 1);
      g.fillPoints(points, true);
    };
    if (!panorama) {
      ridge(this.siteFar, p.ridgeFar, 0.22 * u, 1.3, u * 0.25);
      ridge(this.siteFar, p.ridgeNear, 0.12 * u, 4.1, u * 0.18);
    }

    // Haze: the air between the camera and the horizon lightens it.
    this.siteHaze = this.add.graphics().setDepth(-9.5);
    this.siteHaze.fillGradientStyle(p.haze, p.haze, p.haze, p.haze, 0, 0, night ? 0.35 : 0.6, night ? 0.35 : 0.6);
    this.siteHaze.fillRect(-span, S - 0.35 * u, span * 2, 0.35 * u);

    // --- mid: treeline, ground strip, distant structures ---
    this.siteMid = this.add.graphics().setDepth(-9);
    const g = this.siteMid;
    // Treeline in small bumps, with a clearing around the pad.
    g.fillStyle(p.trees, 1);
    for (let x = -span; x < span && !panorama; x += u * 0.06) {
      if (Math.abs(x) < u * 2.4) continue;
      const h = u * (0.035 + 0.025 * (0.5 + 0.5 * ridgeNoise(x / u * 3, 7.7)));
      g.fillEllipse(x, S - h * 0.4, u * 0.09, h * 1.6);
    }
    // Ground: a lit edge, then darker soil below.
    g.fillStyle(p.landEdge, 1);
    g.fillRect(-span, S - 0.004 * u, span * 2, 0.02 * u);
    g.fillStyle(p.land, 1);
    g.fillRect(-span, S + 0.016 * u, span * 2, 0.3 * u);
    // Fields: soft bands that widen towards the viewer.
    for (let row = 0; row < 7; row += 1) {
      g.fillStyle(row % 2 ? p.landDeep : p.landEdge, 0.18);
      const top = S + (0.03 + row * row * 0.03) * u;
      g.fillRect(-span, top, span * 2, (0.02 + row * 0.03) * u);
    }
    // Scrub near the horizon, thinning out towards the viewer.
    let seed = 3;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    g.fillStyle(p.trees, 0.55);
    for (let i = 0; i < 420; i += 1) {
      const depth = rand() ** 2;
      const x = (rand() * 2 - 1) * span;
      if (Math.abs(x) < u * 1.6) continue;
      const size = u * (0.012 + depth * 0.03);
      g.fillEllipse(x, S + 0.02 * u + depth * 0.25 * u, size * 2.2, size);
    }
    // Service road leaving the pad.
    g.fillStyle(p.road, 1);
    g.fillRect(u * 1.6, S, u * 6, 0.012 * u);
    // Distant second tower and a water tower, small with distance.
    const lattice = (x, h, w) => {
      g.fillStyle(p.steel, 0.8);
      g.fillRect(x - w / 2, S - h, w, h);
      g.fillRect(x - w / 2, S - h - h * 0.12, w * 1.8, h * 0.05);
    };
    if (!panorama) {
      lattice(-u * 7.5, u * 0.45, u * 0.06);
      lattice(u * 10, u * 0.32, u * 0.045);
    }
    g.fillStyle(p.steel, panorama ? 0 : 0.85);
    g.fillRect(u * 4.6, S - u * 0.28, u * 0.015, u * 0.28);
    g.fillRect(u * 4.75, S - u * 0.28, u * 0.015, u * 0.28);
    g.fillEllipse(u * 4.68, S - u * 0.3, u * 0.22, u * 0.1);

    // Painted horizon: tiles mirrored side by side so the joins match, sized
    // so its distant towers stand a third of the rocket's height, with the
    // sea line on the ground line. Tinted for night and storm skies.
    this.sitePanorama = [];
    if (panorama) {
      const art = ART.coastPanorama;
      const tint = night ? 0x3b4c6a : this.rocketDef.challenge.wind ? 0x9aa6b2 : 0xf2f0ea;
      const tileWidth = (u * 0.34) / art.towerShare;
      for (let i = -3; i <= 3; i += 1) {
        const tile = this.add
          .image(i * tileWidth, S, art.key)
          .setOrigin(0.5, art.horizon)
          .setFlipX(i % 2 !== 0)
          .setTint(tint)
          .setDepth(-8.95);
        tile.setScale(tileWidth / tile.width);
        this.sitePanorama.push(tile);
      }
    }

    // --- near: apron, flame trench, masts ---
    this.siteNear = this.add.graphics().setDepth(10.5);
    const n = this.siteNear;
    const halfRocket = this.rocketWidth / 2;
    const apronHalf = Math.max(u * 1.1, halfRocket * 6, Math.abs(this.towerLeft || 0) + 0.25 * u);
    // The rocket stands on the surface, so the apron is flush with it and
    // its concrete shoulders slope down into the ground.
    const apronTop = S;
    n.fillStyle(p.concreteDark, 1);
    n.fillPoints([
      { x: -apronHalf, y: apronTop },
      { x: apronHalf, y: apronTop },
      { x: apronHalf + 0.18 * u, y: S + 0.07 * u },
      { x: -apronHalf - 0.18 * u, y: S + 0.07 * u },
    ], true);
    n.fillStyle(p.concrete, 1);
    n.fillRect(-apronHalf, apronTop, apronHalf * 2, 0.012 * u);
    // Hazard stripes at the edges.
    n.fillStyle(0xffd166, night ? 0.55 : 0.9);
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 3; i += 1) {
        n.fillRect(side * (apronHalf - 0.03 * u - i * 0.06 * u) - 0.015 * u, apronTop, 0.03 * u, 0.012 * u);
      }
    });
    // Flame trench: a dark opening under the engines, the deflector beyond it.
    const trenchHalf = Math.max(halfRocket * 1.25, u * 0.06);
    n.fillStyle(0x0b0f12, 1);
    n.fillRect(-trenchHalf, apronTop + 0.012 * u, trenchHalf * 2, 0.045 * u);
    n.fillStyle(0x0b0f12, 0.45);
    n.fillRect(-trenchHalf * 1.35, apronTop + 0.012 * u, trenchHalf * 2.7, 0.012 * u);
    this.padTop = apronTop;

    // Lightning masts with the catenary wire between them.
    const mastH = u * 1.3;
    const masts = [-apronHalf * 0.95, apronHalf * 0.85];
    masts.forEach((x) => {
      n.fillStyle(p.steel, 1);
      n.fillRect(x - 0.008 * u, apronTop - mastH, 0.016 * u, mastH);
      n.fillRect(x - 0.025 * u, apronTop - mastH - 0.04 * u, 0.05 * u, 0.04 * u);
    });
    n.lineStyle(Math.max(0.3, 0.004 * u), p.steel, 0.7);
    n.beginPath();
    for (let i = 0; i <= 20; i += 1) {
      const t = i / 20;
      const x = Phaser.Math.Linear(masts[0], masts[1], t);
      const sag = Math.sin(Math.PI * t) * u * 0.12;
      const y = apronTop - mastH + sag;
      if (i === 0) n.moveTo(x, y); else n.lineTo(x, y);
    }
    n.strokePath();

    // Floodlights at night: lamp heads and soft beams onto the rocket.
    this.siteLights = this.add.graphics().setDepth(19).setBlendMode(Phaser.BlendModes.ADD);
    if (night) {
      const l = this.siteLights;
      [[-apronHalf - 0.35 * u, 0.42 * u], [apronHalf + 0.3 * u, 0.38 * u]].forEach(([x, h]) => {
        n.fillStyle(p.steel, 1);
        n.fillRect(x - 0.006 * u, S - h, 0.012 * u, h);
        n.fillStyle(0xfff1c4, 1);
        n.fillRect(x - 0.03 * u, S - h - 0.025 * u, 0.06 * u, 0.025 * u);
        const sx = x;
        const sy = S - h - 0.012 * u;
        // The beam fans out from the lamp onto the rocket's lower body.
        const tx = -Math.sign(x) * halfRocket;
        for (let k = 0; k < 3; k += 1) {
          l.fillStyle(0xffe8b0, 0.028);
          l.fillTriangle(sx, sy, tx, S - u * (0.12 + k * 0.05), tx, S - u * (0.7 - k * 0.12));
        }
        l.fillStyle(0xfff1c4, 0.5);
        l.fillCircle(sx, sy, 0.03 * u);
      });
    }

    // Engine light on the apron and the ground around it.
    this.siteGlow = this.add.graphics().setDepth(10.6).setBlendMode(Phaser.BlendModes.ADD);
    for (let k = 0; k < 6; k += 1) {
      this.siteGlow.fillStyle(0xff9a3c, 0.12);
      this.siteGlow.fillEllipse(0, S - 0.01 * u, u * (0.4 + k * 0.45), u * (0.05 + k * 0.035));
    }
    this.siteGlow.setAlpha(0);
  },

  getLaunchSiteObjects() {
    return [this.siteFar, this.siteHaze, this.siteMid, ...this.sitePanorama, this.siteNear, this.siteLights, this.siteGlow];
  },

  updateLaunchSite(state, padFade) {
    [this.siteFar, this.siteHaze, this.siteMid, ...this.sitePanorama, this.siteNear].forEach((o) => o.setAlpha(padFade));
    this.siteLights.setAlpha(padFade * (0.85 + Math.random() * 0.05));
    const nearGround = Phaser.Math.Clamp(1 - state.altitude / 3, 0, 1);
    const glow = (this.flameLevel || 0) * nearGround * padFade;
    this.siteGlow.setAlpha(glow * (0.8 + Math.random() * 0.25));
  },
};
