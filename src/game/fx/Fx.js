import Phaser from "phaser";

// Shared visual effects: scene transitions, button feedback, ambient dust,
// celebrations (confetti, sparkles, shockwaves). Textures are generated at
// runtime, so there is nothing to load.
//
// Scenes with several cameras (the flight) must hide each effect from the
// cameras that should not draw it; pass `register(obj)` for that.

const FADE_IN_MS = 320;
const FADE_OUT_MS = 220;
const TEX = { dot: "fx-dot", spark: "fx-spark", confetti: "fx-confetti" };
export const FX_COLORS = {
  celebrate: [0x73f7c0, 0xffd166, 0x68d9ff, 0xff8d7a, 0xb79bff, 0xffffff],
  gold: [0xffd166, 0xffe9a8, 0xffb347, 0xffffff],
};

export function ensureFxTextures(scene) {
  const textures = scene.textures;
  if (!textures.exists(TEX.dot)) {
    const size = 32;
    const canvas = textures.createCanvas(TEX.dot, size, size);
    const ctx = canvas.getContext();
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
  if (!textures.exists(TEX.spark)) {
    const size = 32;
    const canvas = textures.createCanvas(TEX.spark, size, size);
    const ctx = canvas.getContext();
    const c = size / 2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    // Four-pointed star.
    for (let i = 0; i < 8; i += 1) {
      const r = i % 2 === 0 ? c : c * 0.22;
      const a = (Math.PI / 4) * i - Math.PI / 2;
      ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    canvas.refresh();
  }
  if (!textures.exists(TEX.confetti)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 8, 12);
    g.generateTexture(TEX.confetti, 8, 12);
    g.destroy();
  }
}

function cameraList(scene) {
  return scene.cameras?.cameras || [];
}

// ---------- transitions ----------

export function fadeInScene(scene, duration = FADE_IN_MS) {
  cameraList(scene).forEach((camera) => camera.fadeIn(duration, 4, 9, 16));
}

// Fades every camera out, then starts the next scene (which fades in).
export function transitionTo(scene, key, data) {
  if (scene.__fxLeaving) return;
  scene.__fxLeaving = true;
  if (scene.input) scene.input.enabled = false;
  const cameras = cameraList(scene);
  if (!cameras.length) {
    scene.scene.start(key, data);
    return;
  }
  cameras.forEach((camera) => camera.fadeOut(FADE_OUT_MS, 4, 9, 16));
  scene.time.delayedCall(FADE_OUT_MS + 20, () => scene.scene.start(key, data));
}

// ---------- buttons ----------

// Every interactive rectangle or text grows a little on hover and squashes
// on press, in every scene, without each button wiring it up.
function installButtonFeedback(scene) {
  const eligible = (obj) =>
    obj && obj.input?.enabled && (obj instanceof Phaser.GameObjects.Rectangle || obj instanceof Phaser.GameObjects.Text) &&
    obj.alpha > 0.02 && obj.width * obj.height > 300;
  const base = (obj) => {
    if (obj.__fxBase == null || (!scene.tweens.isTweening(obj) && !obj.__fxHover)) obj.__fxBase = obj.scaleX;
    return obj.__fxBase;
  };
  const to = (obj, factor, duration) => {
    scene.tweens.killTweensOf(obj);
    scene.tweens.add({ targets: obj, scaleX: base(obj) * factor, scaleY: base(obj) * factor, duration, ease: "Quad.easeOut" });
  };
  let lastHover = 0;
  scene.input.on("gameobjectover", (_pointer, obj) => {
    if (!eligible(obj)) return;
    base(obj);
    obj.__fxHover = true;
    to(obj, 1.04, 120);
    const now = scene.time.now;
    if (now - lastHover > 90) {
      lastHover = now;
      scene.registry.get("audio")?.playHover?.();
    }
  });
  scene.input.on("gameobjectout", (_pointer, obj) => {
    if (obj?.__fxBase == null) return;
    obj.__fxHover = false;
    to(obj, 1, 140);
  });
  scene.input.on("gameobjectdown", (_pointer, obj) => {
    if (!eligible(obj)) return;
    base(obj);
    scene.tweens.killTweensOf(obj);
    scene.tweens.add({
      targets: obj,
      scaleX: obj.__fxBase * 0.94,
      scaleY: obj.__fxBase * 0.94,
      duration: 70,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => obj.active && obj.setScale(obj.__fxBase * (obj.__fxHover ? 1.04 : 1)),
    });
  });
}

// Called once from main.js: fades every scene in and gives every button feedback.
export function installFx(game) {
  const hook = (scene) => {
    if (scene.__fxInstalled) return;
    scene.__fxInstalled = true;
    scene.sys.events.on(Phaser.Scenes.Events.CREATE, () => {
      scene.__fxLeaving = false;
      ensureFxTextures(scene);
      fadeInScene(scene);
      installButtonFeedback(scene);
    });
  };
  game.events.once(Phaser.Core.Events.READY, () => game.scene.scenes.forEach(hook));
}

// ---------- particles ----------

function finish(scene, emitter, life) {
  scene.time.delayedCall(life + 200, () => emitter.destroy());
}

// Confetti thrown up from (x, y), falling and spinning, in screen space by default.
export function confetti(scene, x, y, { count = 70, colors = FX_COLORS.celebrate, depth = 900, spread = 1, register, scrollFactor = 0 } = {}) {
  ensureFxTextures(scene);
  const emitter = scene.add.particles(x, y, TEX.confetti, {
    speed: { min: 260 * spread, max: 620 * spread },
    angle: { min: 225, max: 315 },
    gravityY: 900,
    rotate: { start: 0, end: 720, random: true },
    scaleX: { min: 0.6, max: 1.1 },
    scaleY: { min: 0.5, max: 1 },
    lifespan: { min: 1300, max: 2200 },
    alpha: { start: 1, end: 0, ease: "Quad.easeIn" },
    tint: colors,
    emitting: false,
  }).setDepth(depth).setScrollFactor(scrollFactor);
  register?.(emitter);
  emitter.explode(count);
  finish(scene, emitter, 2200);
  return emitter;
}

// A quick glittering burst.
export function sparkles(scene, x, y, { count = 24, color = 0xffffff, colors, depth = 900, speed = 220, scale = 0.5, register, scrollFactor = 0 } = {}) {
  ensureFxTextures(scene);
  const emitter = scene.add.particles(x, y, TEX.spark, {
    speed: { min: speed * 0.3, max: speed },
    angle: { min: 0, max: 360 },
    rotate: { min: 0, max: 90 },
    scale: { start: scale, end: 0 },
    lifespan: { min: 450, max: 900 },
    tint: colors || color,
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  }).setDepth(depth).setScrollFactor(scrollFactor);
  register?.(emitter);
  emitter.explode(count);
  finish(scene, emitter, 900);
  return emitter;
}

// An expanding ring that fades out.
export function shockwave(scene, x, y, { color = 0xffffff, radius = 120, duration = 650, width = 4, depth = 900, register, scrollFactor = 0 } = {}) {
  const ring = scene.add.circle(x, y, radius).setStrokeStyle(width, color, 1).setDepth(depth).setScrollFactor(scrollFactor);
  ring.setScale(0.1);
  register?.(ring);
  scene.tweens.add({
    targets: ring,
    scale: 1,
    alpha: 0,
    duration,
    ease: "Cubic.easeOut",
    onComplete: () => ring.destroy(),
  });
  return ring;
}

// Dust motes drifting through light, in screen space. Returns the emitter.
export function ambientDust(scene, { depth = 0, color = 0xffe7c2, alpha = 0.35, count = 40, area, register } = {}) {
  ensureFxTextures(scene);
  const { width, height } = scene.scale;
  const zone = area || { x: 0, y: 0, width, height };
  const emitter = scene.add.particles(0, 0, TEX.dot, {
    x: { min: zone.x, max: zone.x + zone.width },
    y: { min: zone.y, max: zone.y + zone.height },
    speedX: { min: -8, max: 8 },
    speedY: { min: -14, max: -2 },
    scale: { min: 0.05, max: 0.22 },
    // Fade in and out over the mote's life.
    alpha: { onEmit: () => 0, onUpdate: (_particle, _key, t) => Math.sin(t * Math.PI) * alpha },
    lifespan: { min: 4000, max: 8000 },
    frequency: 9000 / count,
    tint: color,
    blendMode: Phaser.BlendModes.ADD,
  }).setDepth(depth).setScrollFactor(0);
  emitter.fastForward(6000);
  register?.(emitter);
  return emitter;
}

// Bright full-screen flash on every camera.
export function flash(scene, duration = 220, color = [255, 255, 255]) {
  cameraList(scene).forEach((camera) => camera.flash(duration, ...color));
}
