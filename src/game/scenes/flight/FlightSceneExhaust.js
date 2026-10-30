import Phaser from "phaser";
import { DAY_SKY_FADE_END_ALTITUDE, FIRE_POOL_SIZE, SMOKE_POOL_SIZE } from "./FlightSceneConstants.js";
import { getThrustVisual } from "./FlightSceneUtils.js";

const GLOW_TEXTURE = "fx-glow";
const PLUME_TEXTURE = "fx-plume";
const SMOKE_TEXTURE = "fx-smoke";
const GLOW_SIZE = 64;
const SMOKE_SIZE = 96;
const DIAMOND_COUNT = 4;
// Below this altitude the jet still reaches the ground and rolls out into
// big clouds; above it the engines leave a thinning trail.
const GROUND_SMOKE_ALTITUDE = 12;
const FIRE_LIGHT = 0xffa65c;

// How each propellant burns, after real launch footage. Kerosene: orange and
// sooty. Hydrogen: a faint bluish flame and clean white steam. Solid boosters:
// blinding yellow-white with thick white smoke. Methane: clean, blue fringe.
const PROPELLANTS = {
  kerosene: {
    core: 0xfff4dc,
    flame: 0xffa443,
    outer: 0xff5e1f,
    glow: 0xff8a2a,
    diamond: 0xfff0c4,
    brightness: 1,
    smoke: 0xd8d0c6,
    smokeAmount: 1,
    smokeLife: 1,
  },
  hydrogen: {
    core: 0xf4f7ff,
    flame: 0xa9c6ff,
    outer: 0x6680ff,
    glow: 0xb8ccff,
    diamond: 0xffe4f2,
    brightness: 0.5,
    smoke: 0xffffff,
    smokeAmount: 0.6,
    smokeLife: 0.6,
  },
  solid: {
    core: 0xffffff,
    flame: 0xfff1bd,
    outer: 0xffa83c,
    glow: 0xffd27a,
    diamond: null,
    brightness: 1.15,
    smoke: 0xf6f4f0,
    smokeAmount: 1.8,
    smokeLife: 1.4,
  },
  methane: {
    core: 0xffffff,
    flame: 0xffc690,
    outer: 0x7e8cff,
    glow: 0xffb27a,
    diamond: 0xe2e6ff,
    brightness: 0.85,
    smoke: 0xeaeef2,
    smokeAmount: 0.7,
    smokeLife: 0.8,
  },
};

function mixColor(from, to, amount) {
  const t = Phaser.Math.Clamp(amount, 0, 1);
  const channel = (shift) => {
    const a = (from >> shift) & 0xff;
    return Math.round(a + (((to >> shift) & 0xff) - a) * t) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

// Greyscale textures drawn pixel by pixel once, then tinted per sprite.
// shade(u, v) returns [lightness 0-255, alpha 0-1] for a point in 0-1 space.
function createShadedTexture(scene, key, width, height, shade) {
  if (scene.textures.exists(key)) {
    return;
  }
  const texture = scene.textures.createCanvas(key, width, height);
  const context = texture.getContext();
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [light, alpha] = shade((x + 0.5) / width, (y + 0.5) / height);
      const index = (y * width + x) * 4;
      image.data[index] = light;
      image.data[index + 1] = light;
      image.data[index + 2] = light;
      image.data[index + 3] = Math.round(Phaser.Math.Clamp(alpha, 0, 1) * 255);
    }
  }
  context.putImageData(image, 0, 0);
  texture.refresh();
  // The game renders without antialiasing; these must stay soft.
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

function createExhaustTextures(scene) {
  createShadedTexture(scene, GLOW_TEXTURE, GLOW_SIZE, GLOW_SIZE, (u, v) => {
    const distance = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2);
    return [255, Math.pow(1 - distance, 2.2)];
  });

  // A jet seen from the side: narrow and dense at the nozzle (top), wider and
  // fading towards the tail.
  createShadedTexture(scene, PLUME_TEXTURE, 32, 128, (u, v) => {
    const halfWidth = 0.22 + 0.78 * Math.pow(v, 0.55);
    const across = Math.abs(u * 2 - 1) / halfWidth;
    const edge = Math.max(0, 1 - across * across);
    const fadeIn = Phaser.Math.Clamp(v / 0.05, 0, 1);
    return [255, Math.pow(edge, 1.4) * Math.pow(1 - v, 1.4) * fadeIn];
  });

  // A lumpy puff made of overlapping blobs, lit from the top left so the
  // clouds read as volumes instead of flat discs.
  const random = seededRandom(7);
  const blobs = Array.from({ length: 9 }, () => {
    const angle = random() * Math.PI * 2;
    const distance = random() * 0.2;
    return { x: 0.5 + Math.cos(angle) * distance, y: 0.5 + Math.sin(angle) * distance, radius: 0.16 + random() * 0.14 };
  });
  createShadedTexture(scene, SMOKE_TEXTURE, SMOKE_SIZE, SMOKE_SIZE, (u, v) => {
    let density = 0;
    blobs.forEach((blob) => {
      const d = Math.hypot(u - blob.x, v - blob.y) / blob.radius;
      if (d < 1) {
        density += (1 - d * d) ** 2;
      }
    });
    const border = Math.min(1, (1 - Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2)) * 3);
    const light = 0.8 + 0.2 * Phaser.Math.Clamp((0.5 - v) * 2 + (0.5 - u) * 0.8, -1, 1);
    return [Math.round(255 * light), Math.min(1, density * 0.85) * border];
  });
}

export const flightSceneExhaustMethods = {
  createExhaust() {
    createExhaustTextures(this);
    const { width, height } = this.scale;
    const mobile = width < 760 || (width < 920 && height > width * 1.15);

    this.particleDensity = mobile ? 0.55 : 1;
    // Puffs and flames are sized for a 40-unit rocket.
    this.exhaustScale = Phaser.Math.Clamp(this.rocketHeight / 40, 0.6, 1.4);
    this.flameLevel = 0;
    this.ignitionFlash = 0;
    this.engineLit = false;
    this.smokeBudget = 0;
    this.fireBudget = 0;

    // Smoke behind the rocket, flames and hot gas, then smoke in front of it
    // so the rocket rises out of its own cloud.
    this.smokeBack = this.add.container(0, 0).setDepth(17);
    this.flameLayer = this.add.container(0, 0).setDepth(19);
    this.smokeFront = this.add.container(0, 0).setDepth(21);

    // Additive blending turns any colour white against a daylight sky, so only
    // the white-hot parts add light; the coloured flame is painted normally.
    const flameSprite = (texture, originY, blendMode = Phaser.BlendModes.ADD) => {
      const sprite = this.add.image(0, 0, texture).setOrigin(0.5, originY).setBlendMode(blendMode);
      this.flameLayer.add(sprite.setVisible(false));
      return sprite;
    };
    this.engines = this.rocketDef.engines.map((engine, index) => {
      const propellant = PROPELLANTS[engine.fuel];
      return {
        offset: engine.x,
        propellant,
        phase: index * 1.7,
        glow: flameSprite(GLOW_TEXTURE, 0.5),
        outer: flameSprite(PLUME_TEXTURE, 0, Phaser.BlendModes.NORMAL),
        inner: flameSprite(PLUME_TEXTURE, 0, Phaser.BlendModes.NORMAL),
        core: flameSprite(PLUME_TEXTURE, 0),
        diamonds: propellant.diamond
          ? Array.from({ length: DIAMOND_COUNT }, () => flameSprite(GLOW_TEXTURE, 0.5))
          : [],
      };
    });
    this.smokeWeights = this.engines.map((engine) => engine.propellant.smokeAmount);
    this.smokeWeight = this.smokeWeights.reduce((sum, weight) => sum + weight, 0) / this.engines.length;

    const smokeCount = Math.round(SMOKE_POOL_SIZE * this.particleDensity);
    this.smokeParticles = [];
    this.smokePoolBack = this.createParticlePool(this.smokeBack, SMOKE_TEXTURE, Phaser.BlendModes.NORMAL, Math.round(smokeCount * 0.65));
    this.smokePoolFront = this.createParticlePool(this.smokeFront, SMOKE_TEXTURE, Phaser.BlendModes.NORMAL, Math.round(smokeCount * 0.35));
    this.fireParticles = [];
    this.firePool = this.createParticlePool(
      this.flameLayer,
      GLOW_TEXTURE,
      Phaser.BlendModes.NORMAL,
      Math.round(FIRE_POOL_SIZE * this.particleDensity),
    );
  },

  getExhaustObjects() {
    return [this.smokeBack, this.flameLayer, this.smokeFront];
  },

  createParticlePool(layer, texture, blendMode, size) {
    return Array.from({ length: size }, () => {
      const sprite = this.add.image(0, 0, texture).setBlendMode(blendMode).setVisible(false);
      layer.add(sprite);
      return { sprite };
    });
  },

  // urgent: when the pool is empty, recycle the oldest particle instead of
  // skipping (an explosion must show even while launch clouds fill the pool).
  spawnParticle(active, pool, props, urgent = false) {
    if (pool.length === 0 && urgent) {
      let oldest = -1;
      active.forEach((particle, index) => {
        const progress = particle.age / particle.life;
        if (particle.pool === pool && (oldest < 0 || progress > active[oldest].age / active[oldest].life)) {
          oldest = index;
        }
      });
      if (oldest >= 0) {
        this.retireParticle(active, oldest);
      }
    }
    const particle = pool.pop();
    if (!particle) {
      return;
    }
    Object.assign(particle, props, { pool, age: 0 });
    particle.sprite.setVisible(true).setRotation(Math.random() * Math.PI * 2);
    active.push(particle);
  },

  retireParticle(active, index) {
    const particle = active[index];
    particle.sprite.setVisible(false);
    active[index] = active[active.length - 1];
    active.pop();
    particle.pool.push(particle);
  },

  updateExhaust(state, time, delta) {
    const dt = delta / 1000;
    const target = getThrustVisual(state);
    if (target > 0 && !this.engineLit) {
      this.igniteEngines(state);
    }
    this.engineLit = target > 0;

    // Engines take a few tenths of a second to reach full power and die out faster.
    const rate = target > this.flameLevel ? 7 : 16;
    this.flameLevel += (target - this.flameLevel) * (1 - Math.exp(-dt * rate));
    if (target === 0 && this.flameLevel < 0.02) {
      this.flameLevel = 0;
    }
    this.ignitionFlash = Math.max(0, this.ignitionFlash - dt * 3);

    this.drawFlames(state, time);
    this.emitExhaust(state, dt);
    this.updateSmoke(dt);
    this.updateFire(dt);

    // The pad shakes while the engines roar against the hold-down clamps.
    if (!state.launched && this.flameLevel > 0.1) {
      this.cameras.main.shake(90, 0.001 + 0.0018 * this.flameLevel);
    }
  },

  igniteEngines(state) {
    this.ignitionFlash = 1;
    if (state.altitude > 1) {
      return;
    }
    this.audio?.playIgnition?.();
    const burst = Math.round(26 * this.particleDensity);
    for (let index = 0; index < burst; index += 1) {
      this.emitSmokePuff(1, true);
      this.emitFire(1.3);
    }
  },

  // Unit vectors along the jet (out of the nozzles) and across the rocket.
  getExhaustAxes() {
    const rotation = this.rocket.rotation;
    return {
      along: { x: -Math.sin(rotation), y: Math.cos(rotation) },
      across: { x: Math.cos(rotation), y: Math.sin(rotation) },
    };
  },

  drawFlames(state, time) {
    const level = this.flameLevel;
    const visible = level > 0 || this.ignitionFlash > 0.01;
    const density = state.atmosphereDensity;
    const vacuum = 1 - density;
    const rotation = this.rocket.rotation;
    const { along } = this.getExhaustAxes();
    const single = this.engines.length === 1;
    const baseLength = this.rocketHeight * (single ? 1.5 : 1.15);
    const baseWidth = Math.max(this.rocketWidth * (single ? 0.55 : 0.28), 2);
    // Thin air lets the plume balloon out and fade, like high-altitude launches at dusk.
    const spread = 1 + Math.pow(vacuum, 1.5) * 2.6;
    const seconds = time / 1000;

    this.engines.forEach((engine) => {
      const parts = [engine.glow, engine.outer, engine.inner, engine.core, ...engine.diamonds];
      if (!visible) {
        parts.forEach((part) => part.setVisible(false));
        return;
      }

      const fuel = engine.propellant;
      const anchor = this.getExhaustAnchor(engine.offset);
      const flicker =
        1 +
        Math.sin(seconds * 31 + engine.phase) * 0.04 +
        Math.sin(seconds * 73 + engine.phase * 2.3) * 0.03 +
        (Math.random() - 0.5) * 0.05;
      const width = baseWidth * (0.7 + 0.3 * level);
      let length = baseLength * level * flicker * (1 + vacuum * 0.6);

      // Near the pad the jet dives into the flame trench and stops there; the
      // hot gas particles show it splashing out along the ground.
      const { centerY, radius: groundRadius } = this.groundShape;
      const fromCenter = Math.hypot(anchor.x, anchor.y - centerY);
      const downward = -(along.x * anchor.x + along.y * (anchor.y - centerY)) / fromCenter;
      const clearance = fromCenter - groundRadius;
      if (downward > 0.1) {
        length = Math.min(length, clearance / downward + width * 2.2);
      }

      const plume = (sprite, plumeWidth, plumeLength, color, alpha) =>
        sprite
          .setVisible(alpha > 0.01)
          .setPosition(anchor.x, anchor.y)
          .setRotation(rotation)
          .setDisplaySize(plumeWidth, Math.max(plumeLength, 0.01))
          .setTint(color)
          .setAlpha(Math.min(1, alpha));
      plume(engine.outer, width * 1.3 * spread, length, fuel.outer, 0.6 * fuel.brightness * level * (0.4 + 0.6 * density));
      plume(engine.inner, width * 0.75 * (1 + vacuum * 0.9), length * 0.62, fuel.flame, 0.95 * fuel.brightness * level);
      plume(engine.core, width * 0.36, length * 0.32, fuel.core, level * 1.2);

      // The glow is strongest on the pad, where it lights up the ground and the smoke.
      const onPad = Phaser.Math.Clamp(1 - clearance / this.rocketHeight, 0, 1);
      const glowSize = width * (2.6 + onPad * 1.6 + this.ignitionFlash * 5);
      engine.glow
        .setVisible(true)
        .setPosition(anchor.x + along.x * width * 0.4, anchor.y + along.y * width * 0.4)
        .setDisplaySize(glowSize, glowSize)
        .setTint(fuel.glow)
        .setAlpha(Math.min(1, (0.35 + onPad * 0.25) * level * fuel.brightness + this.ignitionFlash * 0.9));

      // Shock diamonds: bright knots in the jet, only while the air still squeezes it.
      const diamondAlpha = level * Phaser.Math.Clamp((density - 0.15) / 0.5, 0, 1);
      engine.diamonds.forEach((diamond, index) => {
        const distance = width * (1 + index * 1.05) * (0.8 + 0.2 * level);
        const size = width * (0.55 - index * 0.08);
        diamond
          .setVisible(diamondAlpha > 0.02 && distance < length * 0.6)
          .setPosition(anchor.x + along.x * distance, anchor.y + along.y * distance)
          .setRotation(rotation)
          .setDisplaySize(size * 0.8, size * 1.3)
          .setTint(fuel.diamond)
          .setAlpha(diamondAlpha * (0.8 - index * 0.15) * (0.85 + Math.random() * 0.15));
      });
    });
  },

  emitExhaust(state, dt) {
    const level = this.flameLevel;
    if (level <= 0.05) {
      return;
    }

    const ground = Phaser.Math.Clamp(1 - state.altitude / GROUND_SMOKE_ALTITUDE, 0, 1);
    const density = state.atmosphereDensity;
    const trail = state.altitude < DAY_SKY_FADE_END_ALTITUDE ? density : 0;
    const smokeRate = (ground > 0 ? 10 + 34 * ground : 14 * trail) * level * this.smokeWeight;
    this.smokeBudget += smokeRate * this.particleDensity * dt;
    while (this.smokeBudget >= 1) {
      this.smokeBudget -= 1;
      this.emitSmokePuff(ground, false, trail);
    }

    if (ground > 0) {
      this.fireBudget += 55 * level * Math.sqrt(ground) * this.particleDensity * dt;
      while (this.fireBudget >= 1) {
        this.fireBudget -= 1;
        this.emitFire(level);
      }
    }
  },

  // Rockets with boosters make most of their smoke from the boosters.
  pickEngine() {
    let roll = Math.random() * this.smokeWeights.reduce((sum, weight) => sum + weight, 0);
    for (let index = 0; index < this.engines.length; index += 1) {
      roll -= this.smokeWeights[index];
      if (roll <= 0) {
        return this.engines[index];
      }
    }
    return this.engines[0];
  },

  // ground: 1 on the pad down to 0 once the jet no longer reaches the ground.
  emitSmokePuff(ground, sideways = false, trail = 1) {
    const engine = this.pickEngine();
    const fuel = engine.propellant;
    const anchor = this.getExhaustAnchor(engine.offset);
    const { along, across } = this.getExhaustAxes();
    const scale = this.exhaustScale;
    const big = ground > 0;
    // On the pad the jet drives the smoke into the ground; once the rocket is
    // up, the smoke stays where it was left and builds a column. The ignition
    // burst blasts sideways along the pad instead of down.
    const push = ground * ground;
    const speed =
      ((big ? Phaser.Math.FloatBetween(90, 200) * push : 0) + Phaser.Math.FloatBetween(10, 30) * (1 - push)) * scale;
    const sideSpeed = sideways ? Phaser.Math.FloatBetween(-1, 1) * speed : Phaser.Math.FloatBetween(-0.35, 0.35) * speed;
    const start = this.rocketHeight * (big ? Phaser.Math.FloatBetween(0.03, 0.25) : Phaser.Math.FloatBetween(0.3, 0.6));
    const jitter = Phaser.Math.FloatBetween(-0.3, 0.3) * this.rocketWidth;

    this.spawnParticle(this.smokeParticles, big && Math.random() < 0.4 ? this.smokePoolFront : this.smokePoolBack, {
      x: anchor.x + along.x * start + across.x * jitter,
      y: anchor.y + along.y * start + across.y * jitter,
      vx: along.x * speed * (sideways ? 0.4 : 1) + across.x * sideSpeed,
      vy: along.y * speed * (sideways ? 0.4 : 1) + across.y * sideSpeed,
      size: Phaser.Math.FloatBetween(2, 4) * scale,
      endSize: big ? Phaser.Math.FloatBetween(12, 24) * scale * (0.7 + ground * 0.5) : Phaser.Math.FloatBetween(5, 9) * scale,
      life: (big ? Phaser.Math.FloatBetween(2.8, 5) : Phaser.Math.FloatBetween(1.6, 2.8)) * fuel.smokeLife,
      drag: big ? Phaser.Math.FloatBetween(1.4, 2.2) : 0.8,
      buoyancy: big ? Phaser.Math.FloatBetween(3, 8) * scale : Phaser.Math.FloatBetween(0, 2),
      drift: Phaser.Math.FloatBetween(2, 5) * scale,
      spin: Phaser.Math.FloatBetween(-0.4, 0.4),
      color: fuel.smoke,
      alpha: big ? Phaser.Math.FloatBetween(0.6, 0.85) : 0.5 * trail,
    });
  },

  // Hot gas leaving the nozzles; near the ground it splashes out along the pad.
  emitFire(level) {
    const engine = this.engines[Phaser.Math.Between(0, this.engines.length - 1)];
    const fuel = engine.propellant;
    const anchor = this.getExhaustAnchor(engine.offset);
    const { along, across } = this.getExhaustAxes();
    const scale = this.exhaustScale;
    const speed = Phaser.Math.FloatBetween(150, 260) * scale;
    const side = Phaser.Math.FloatBetween(-0.25, 0.25) * speed;

    this.spawnParticle(this.fireParticles, this.firePool, {
      x: anchor.x,
      y: anchor.y,
      vx: along.x * speed + across.x * side,
      vy: along.y * speed + across.y * side,
      size: Phaser.Math.FloatBetween(2.5, 4.5) * scale,
      endSize: Phaser.Math.FloatBetween(10, 18) * scale,
      life: Phaser.Math.FloatBetween(0.25, 0.5),
      drag: 3,
      colorStart: fuel.flame,
      colorEnd: fuel.outer,
      alpha: Math.min(1, 0.9 * fuel.brightness * level),
    });
  },

  // A crash: a flash, a fireball, then a column of dark smoke.
  emitExplosion(x, y) {
    const scale = this.exhaustScale;
    const flashSize = 70 * scale;
    const flash = this.addWorldObject(
      this.add
        .image(x, y, GLOW_TEXTURE)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xfff1c8)
        .setDepth(31)
        .setDisplaySize(flashSize, flashSize),
    );
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: flash.scale * 1.6,
      duration: 420,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy(),
    });

    const burst = (count, active, pool, make) => {
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        this.spawnParticle(active, pool, make(Math.cos(angle), Math.sin(angle)), true);
      }
    };
    burst(26, this.fireParticles, this.firePool, (dx, dy) => {
      const speed = Phaser.Math.FloatBetween(20, 90) * scale;
      return {
        x,
        y,
        vx: dx * speed,
        vy: dy * speed,
        size: 3 * scale,
        endSize: Phaser.Math.FloatBetween(9, 16) * scale,
        life: Phaser.Math.FloatBetween(0.35, 0.9),
        drag: 2.5,
        colorStart: 0xffe9b0,
        colorEnd: 0xff4a12,
        alpha: 1,
      };
    });
    burst(18, this.smokeParticles, this.smokePoolBack, (dx, dy) => {
      const speed = Phaser.Math.FloatBetween(8, 30) * scale;
      return {
        x,
        y,
        vx: dx * speed,
        vy: dy * speed,
        size: 4 * scale,
        endSize: Phaser.Math.FloatBetween(12, 20) * scale,
        life: Phaser.Math.FloatBetween(2.5, 4),
        drag: 1.2,
        buoyancy: 6 * scale,
        drift: 3 * scale,
        spin: Phaser.Math.FloatBetween(-0.3, 0.3),
        color: 0x3b3632,
        alpha: 0.85,
      };
    });
  },

  extinguishExhaust() {
    this.flameLevel = 0;
    this.ignitionFlash = 0;
    this.engines.forEach((engine) =>
      [engine.glow, engine.outer, engine.inner, engine.core, ...engine.diamonds].forEach((part) => part.setVisible(false)),
    );
  },

  // Keeps a particle above the ground as it is drawn (flat near the pad);
  // anything moving into it is turned sideways, which is what spreads the
  // launch clouds along the pad.
  keepAboveGround(particle, floorOffset) {
    const { centerY, radius } = this.groundShape;
    const distance = Math.hypot(particle.x, particle.y - centerY);
    const floor = radius + floorOffset;
    if (distance >= floor || distance === 0) {
      return;
    }
    const nx = particle.x / distance;
    const ny = (particle.y - centerY) / distance;
    particle.x = nx * floor;
    particle.y = centerY + ny * floor;
    const into = particle.vx * nx + particle.vy * ny;
    if (into >= 0) {
      return;
    }
    const tx = -ny;
    const ty = nx;
    let sideways = particle.vx * tx + particle.vy * ty;
    const direction = Math.sign(sideways) || (Math.random() < 0.5 ? -1 : 1);
    sideways += direction * -into * 0.9;
    particle.vx = tx * sideways - nx * into * 0.05;
    particle.vy = ty * sideways - ny * into * 0.05;
  },

  // Moves a particle with drag, then its own push away from the planet
  // (buoyancy) and along it (wind).
  moveParticle(particle, dt) {
    const radius = Math.hypot(particle.x, particle.y) || 1;
    const nx = particle.x / radius;
    const ny = particle.y / radius;
    const damping = Math.exp(-particle.drag * dt);
    const buoyancy = particle.buoyancy || 0;
    const drift = particle.drift || 0;
    particle.vx = particle.vx * damping + (nx * buoyancy - ny * drift) * dt;
    particle.vy = particle.vy * damping + (ny * buoyancy + nx * drift) * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  },

  updateSmoke(dt) {
    const nozzle = this.getExhaustAnchor(0);
    const heatRadius = this.rocketHeight * 0.8;
    for (let index = this.smokeParticles.length - 1; index >= 0; index -= 1) {
      const particle = this.smokeParticles[index];
      particle.age += dt;
      if (particle.age >= particle.life) {
        this.retireParticle(this.smokeParticles, index);
        continue;
      }

      const t = particle.age / particle.life;
      this.moveParticle(particle, dt);
      const size = particle.size + (particle.endSize - particle.size) * (1 - (1 - t) ** 3);
      this.keepAboveGround(particle, size * 0.45);

      // Quick to appear, slow to clear; smoke near the flame glows orange.
      const fade = Math.min(1, t / 0.06) * (1 - t * t);
      const distance = Math.hypot(particle.x - nozzle.x, particle.y - nozzle.y);
      const heat = this.flameLevel * Phaser.Math.Clamp(1 - distance / heatRadius, 0, 1);
      particle.sprite
        .setPosition(particle.x, particle.y)
        .setScale((size * 2) / SMOKE_SIZE)
        .setRotation(particle.sprite.rotation + particle.spin * dt)
        .setAlpha(particle.alpha * fade)
        .setTint(mixColor(particle.color, FIRE_LIGHT, heat * 0.85));
    }
  },

  updateFire(dt) {
    for (let index = this.fireParticles.length - 1; index >= 0; index -= 1) {
      const particle = this.fireParticles[index];
      particle.age += dt;
      if (particle.age >= particle.life) {
        this.retireParticle(this.fireParticles, index);
        continue;
      }

      const t = particle.age / particle.life;
      this.moveParticle(particle, dt);
      const size = particle.size + (particle.endSize - particle.size) * Math.sqrt(t);
      this.keepAboveGround(particle, size * 0.2);
      particle.sprite
        .setPosition(particle.x, particle.y)
        .setScale((size * 2) / GLOW_SIZE)
        .setAlpha(particle.alpha * (1 - t) ** 1.5)
        .setTint(mixColor(particle.colorStart, particle.colorEnd, t));
    }
  },
};
