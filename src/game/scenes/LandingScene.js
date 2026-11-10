import Phaser from 'phaser';
import { FX_COLORS, confetti, shockwave, sparkles, transitionTo } from '../fx/Fx.js';
import {
  LANDING, LANDING_LEVELS, LANDING_MEDALS, createLandingState, getLandingLevel, getLandingTip,
  getStoppingHeight, isLevelUnlocked, predictTouchdownX, readLandingProgress, recordLanding, stepLanding,
} from '../systems/LandingModel.js';
import FlightTouchControls from '../ui/FlightTouchControls.js';
import { addText } from '../ui/theme.js';

const ASSET = `${import.meta.env.BASE_URL}assets/landing/`;
const STEP = 1 / 120;
// Visual size of the booster artwork in metres (the svg is 80 x 440 units).
const BOOSTER_W = 8;
const BOOSTER_H = 44;
const PAD_SPAN = 64;
const BURN_MARGIN = 25;

const SKIES = {
  day: { top: 0x1a6fe0, bottom: 0x7cc4f5, coast: 0x6d8fa6, ground: 0x93a24a, groundDark: 0x6f7c34, stars: 0 },
  dusk: { top: 0x1f2a57, bottom: 0xf29e6d, coast: 0x3a3550, ground: 0x4a3540, groundDark: 0x2e2129, stars: 0.35 },
  night: { top: 0x030712, bottom: 0x16294a, coast: 0x0d1626, ground: 0x0d1b2c, groundDark: 0x081220, stars: 1 },
};

const GOOD = 0x73f7c0;
const WARN = 0xffd166;
const BAD = 0xff8d7a;
const BURN = 0xffa443;
const css = color => `#${color.toString(16).padStart(6, '0')}`;

export default class LandingScene extends Phaser.Scene {
  constructor() { super({ key: 'LandingScene' }); }

  preload() {
    const svg = (key, file, width, height) => {
      if (!this.textures.exists(key)) this.load.svg(key, `${ASSET}${file}`, { width, height });
    };
    svg('landing-booster', 'booster.svg', 160, 880);
    svg('landing-pad', 'landing-pad.svg', 1520, 140);
    svg('landing-ship', 'droneship.svg', 1800, 380);
    svg('landing-coast', 'coast.svg', 1600, 260);
    // Painted skies, one per level (landing-<id>-backdrop).
    ['pad', 'crosswind', 'droneship'].forEach(id => {
      const key = `landing-${id}-backdrop`;
      if (!this.textures.exists(key)) this.load.image(key, `${ASSET}${id}-backdrop.webp`);
    });
  }

  create() {
    this.audio = this.registry.get('audio');
    this.progress = readLandingProgress();
    this.level = LANDING_LEVELS[0];
    this.mode = 'menu';
    this.touch = { left: false, right: false, thrust: false };
    this.view = { x: 0, scale: 0, shake: 0 };
    this.particles = [];
    this.stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.7, r: Math.random() * 1.3 + 0.4 }));

    this.sky = this.add.graphics().setDepth(0);
    this.coast = this.add.image(0, 0, 'landing-coast').setOrigin(0.5, 1).setDepth(1);
    // Painted sky and shoreline for the first level; its bottom edge is the far grass.
    this.backdrop = this.add.image(0, 0, 'landing-pad-backdrop').setOrigin(0.5, 1).setDepth(1).setVisible(false);
    ['pad', 'crosswind', 'droneship'].forEach(id => {
      const key = `landing-${id}-backdrop`;
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    this.ground = this.add.graphics().setDepth(2);
    this.padImage = this.add.image(0, 0, 'landing-pad').setDepth(3);
    this.shipImage = this.add.image(0, 0, 'landing-ship').setDepth(3);
    this.sea = this.add.graphics().setDepth(4);
    this.guides = this.add.graphics().setDepth(5);
    this.fx = this.add.graphics().setDepth(7);
    this.legs = this.add.graphics();
    this.flame = this.add.graphics();
    this.boosterImage = this.add.image(0, 0, 'landing-booster').setOrigin(0.5, 1);
    this.booster = this.add.container(0, 0, [this.flame, this.legs, this.boosterImage]).setDepth(6);
    [this.coast, this.padImage, this.shipImage, this.boosterImage]
      .forEach(o => o.texture.setFilter(Phaser.Textures.FilterMode.LINEAR));

    this.hudPanel = this.add.graphics().setDepth(20);
    this.gauges = this.add.graphics().setDepth(21);
    this.hudTitle = addText(this, 0, 0, '', { size: 13, bold: true, color: '#8fa8c0' }).setDepth(22);
    this.hudAltitude = addText(this, 0, 0, '', { size: 26, bold: true }).setDepth(22);
    this.hudLabels = ['DESCENSO', 'LATERAL', 'INCLINACIÓN', 'COMBUSTIBLE']
      .map(label => ({
        label: addText(this, 0, 0, label, { size: 10, bold: true, color: '#8fa8c0' }).setDepth(22),
        value: addText(this, 0, 0, '', { size: 11, bold: true }).setOrigin(1, 0).setDepth(22),
      }));
    this.hint = addText(this, 0, 0, '', { size: 16, bold: true, align: 'center', color: '#8ff5c4' })
      .setOrigin(0.5).setDepth(22).setShadow(0, 2, '#000000', 4, true, true);
    this.burnLabel = addText(this, 0, 0, 'ENCIENDE', { size: 11, bold: true, color: css(BURN) })
      .setOrigin(0, 1).setDepth(8);
    this.back = this.makeButton('HANGAR', () => this.leave(), { width: 98, height: 34, depth: 30 });

    this.keys = this.input.keyboard.addKeys('SPACE,W,UP,A,D,LEFT,RIGHT,ESC,ENTER,R');
    this.controls = new FlightTouchControls(this, {
      onSteerLeft: value => { this.touch.left = value; },
      onSteerRight: value => { this.touch.right = value; },
      onThrust: value => { this.touch.thrust = value; },
    });
    this.controls.create();
    this.overlay = this.add.container(0, 0).setDepth(60);

    const blur = () => { if (this.mode === 'fly') this.pause(); };
    this.game.events.on(Phaser.Core.Events.BLUR, blur);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      this.game.events.off(Phaser.Core.Events.BLUR, blur);
      this.scale.off('resize', this.layout, this);
      this.audio?.stopFlightSounds?.();
    });

    this.resetAttempt();
    this.layout();
    this.showMenu();
  }

  // ---------- flow ----------

  resetAttempt() {
    this.state = createLandingState(this.level);
    this.accumulator = 0;
    this.track = [];
    this.burnStartAltitude = null;
    this.legDeploy = 0;
    this.particles = [];
    this.exploded = false;
    this.booster.setVisible(true);
    this.view.scale = 0;
    const ghost = this.progress.ghosts[this.level.id];
    this.ghost = Array.isArray(ghost) && ghost.length > 1 ? ghost : null;
  }

  startLevel(level) {
    this.level = level;
    this.resetAttempt();
    this.showBriefing();
  }

  fly() {
    this.mode = 'fly';
    this.accumulator = 0;
    this.clearOverlay();
  }

  pause() {
    this.mode = 'paused';
    this.touch = { left: false, right: false, thrust: false };
    this.controls.buttons.forEach(button => button.setActive(false));
    this.input.keyboard.resetKeys();
    this.audio?.stopEngine?.();
    this.showPanel([
      { text: 'EN PAUSA', size: 22, bold: true },
      { text: this.level.title, color: '#8fa8c0' },
    ], [
      { label: 'CONTINUAR', action: () => this.fly(), primary: true },
      { label: 'MISIONES', action: () => this.showMenu() },
    ]);
  }

  leave() {
    if (this.mode === 'menu') transitionTo(this, 'HangarScene');
    else this.showMenu();
  }

  finish() {
    this.mode = 'done';
    const s = this.state;
    const r = s.result;
    this.sample(true);
    this.audio?.stopEngine?.();
    if (r.success) {
      this.audio?.playPlace?.();
      this.time.delayedCall(250, () => this.audio?.playSuccess?.());
      this.view.shake = 4;
    } else {
      this.explode();
    }
    const { improved, previous, progress } = recordLanding(this.level.id, r, this.track);
    this.progress = progress;
    const tip = getLandingTip(s, this.burnStartAltitude);
    const index = LANDING_LEVELS.indexOf(this.level);
    const next = LANDING_LEVELS[index + 1];
    const nextOpen = next && isLevelUnlocked(progress, next.id);
    const medal = LANDING_MEDALS.find(m => m.id === r.medal);

    this.time.delayedCall(r.success ? 900 : 1300, () => {
      if (this.mode !== 'done') return;
      const lines = r.success
        ? [
          { text: '¡PROPULSOR RECUPERADO!', size: 22, bold: true, color: '#8ff5c4' },
          { medal },
          { text: `${r.score} / 1000${improved && previous ? `   ·   récord (antes ${previous})` : improved ? '   ·   ¡primera marca!' : ''}`, size: 18, bold: true },
          { bars: r.parts },
          { text: tip, color: '#cfe0f0' },
        ]
        : [
          { text: 'ATERRIZAJE FALLIDO', size: 22, bold: true, color: css(BAD) },
          { text: r.reason },
          { text: `Descenso ${Math.abs(s.vy).toFixed(1)} m/s · Lateral ${Math.abs(s.vx - s.padVx).toFixed(1)} m/s`, color: '#8fa8c0' },
          { text: tip, color: '#ffd166' },
        ];
      const buttons = [{ label: 'REINTENTAR', action: () => { this.resetAttempt(); this.fly(); }, primary: !r.success || !nextOpen }];
      if (r.success && nextOpen) buttons.push({ label: 'SIGUIENTE', action: () => this.startLevel(next), primary: true });
      buttons.push({ label: 'MISIONES', action: () => this.showMenu() });
      this.showPanel(lines, buttons);
      if (r.success) {
        const { width: w, height: h } = this.scale;
        const gold = medal?.id === 'gold';
        confetti(this, w / 2, h * 0.3, { count: gold ? 120 : 70, colors: gold ? FX_COLORS.gold : FX_COLORS.celebrate });
        if (this.medalCenter) {
          const { x, y } = this.medalCenter;
          sparkles(this, x, y, { count: 26, color: medal?.color ?? 0xffffff, speed: 180, scale: 0.45 });
          shockwave(this, x, y, { color: medal?.color ?? 0xffffff, radius: 60 });
        }
      }
    });
  }

  // ---------- overlay panels ----------

  makeButton(label, action, { width = 150, height = 42, primary = true, depth = 62 } = {}) {
    const bg = this.add.rectangle(0, 0, width, height, primary ? 0x205443 : 0x1a2733)
      .setStrokeStyle(1, primary ? GOOD : 0x5b7489).setInteractive({ useHandCursor: true }).setDepth(depth);
    const text = addText(this, 0, 0, label, { size: 13, bold: true }).setOrigin(0.5).setDepth(depth + 1);
    bg.on('pointerover', () => bg.setFillStyle(primary ? 0x2b6d57 : 0x24394a));
    bg.on('pointerout', () => bg.setFillStyle(primary ? 0x205443 : 0x1a2733));
    bg.on('pointerdown', () => { this.audio?.playClick?.(); action(); });
    return {
      bg, label: text,
      setPosition(x, y) { bg.setPosition(x, y); text.setPosition(x, y); return this; },
    };
  }

  clearOverlay() {
    this.overlay.removeAll(true);
    this.primaryAction = null;
    this.controls.buttons.forEach(b => { b.background.input.enabled = this.mode === 'fly'; });
  }

  // lines: { text, size, bold, color } | { medal } | { bars }; buttons: { label, action, primary }.
  showPanel(lines, buttons) {
    this.clearOverlay();
    this.controls.buttons.forEach(b => { b.background.input.enabled = false; });
    const { width: w, height: h } = this.scale;
    const pw = Math.min(w - 24, 460);
    const wrap = pw - 48;
    const items = [];
    let y = 0;
    let medalY = null;
    lines.forEach(line => {
      if (line.medal) {
        const g = this.add.graphics();
        this.drawMedal(g, 0, y + 30, 26, line.medal);
        const t = addText(this, 0, y + 30, line.medal.label, { size: 11, bold: true, color: '#0b121a' }).setOrigin(0.5);
        medalY = y + 30;
        items.push({ obj: g, y: 0, graphics: true }, { obj: t, y: y + 30, center: true });
        y += 70;
      } else if (line.bars) {
        const g = this.add.graphics();
        const entries = [['Precisión', line.bars.precision, 400], ['Suavidad', line.bars.softness, 400], ['Combustible', line.bars.fuel, 200]];
        entries.forEach(([label, value, max], i) => {
          const rowY = y + i * 24;
          const t = addText(this, -wrap / 2, rowY, label, { size: 12, color: '#8fa8c0' });
          const v = addText(this, wrap / 2, rowY, `${value}/${max}`, { size: 12, bold: true }).setOrigin(1, 0);
          g.fillStyle(0x1d2a38); g.fillRoundedRect(-wrap / 2 + 96, rowY + 4, wrap - 160, 8, 4);
          g.fillStyle(value / max > 0.75 ? GOOD : value / max > 0.4 ? WARN : BAD);
          g.fillRoundedRect(-wrap / 2 + 96, rowY + 4, Math.max(8, (wrap - 160) * value / max), 8, 4);
          items.push({ obj: t, y: rowY, keepX: true }, { obj: v, y: rowY, keepX: true });
        });
        items.push({ obj: g, y: 0, graphics: true });
        y += entries.length * 24 + 8;
      } else if (line.card) {
        const card = line.card;
        const ch = 74;
        const g = this.add.graphics();
        g.fillStyle(card.locked ? 0x111a23 : 0x15222e, 1);
        g.fillRoundedRect(-wrap / 2, y, wrap, ch, 10);
        g.lineStyle(1, card.locked ? 0x2b3a48 : 0x4f6f88, 1);
        g.strokeRoundedRect(-wrap / 2, y, wrap, ch, 10);
        const title = addText(this, -wrap / 2 + 16, y + 12, `${card.index}. ${card.level.title}`, { size: 15, bold: true, color: card.locked ? '#5b6f80' : '#f3f7fb' });
        const place = addText(this, -wrap / 2 + 16, y + 36, card.locked ? 'Aterriza en la misión anterior para desbloquear' : card.level.place, { size: 11, color: '#8fa8c0' });
        const medal = card.best ? LANDING_MEDALS.find(m => card.best >= m.min) : null;
        if (medal) this.drawMedal(g, wrap / 2 - 34, y + ch / 2 - 6, 14, medal);
        const best = addText(this, wrap / 2 - 34, y + ch - 16, card.locked ? 'BLOQUEADA' : card.best ? `${card.best}` : 'NUEVA', { size: 11, bold: true, color: medal ? css(medal.color) : '#8ff5c4' }).setOrigin(0.5);
        items.push({ obj: g, y: 0, graphics: true }, { obj: title, y: y + 12, keepX: true }, { obj: place, y: y + 36, keepX: true }, { obj: best, y: y + ch - 16, keepX: true });
        if (!card.locked) {
          const hit = this.add.rectangle(0, y + ch / 2, wrap, ch, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
          hit.on('pointerover', () => g.setAlpha(0.85));
          hit.on('pointerout', () => g.setAlpha(1));
          hit.on('pointerdown', () => { this.audio?.playClick?.(); this.startLevel(card.level); });
          items.push({ obj: hit, y: y + ch / 2, keepX: true });
        }
        y += ch + 10;
      } else {
        const t = addText(this, 0, y, line.text, {
          size: line.size || 14, bold: line.bold, color: line.color || '#f3f7fb', align: 'center', lineSpacing: 5,
        }).setOrigin(0.5, 0).setWordWrapWidth(wrap);
        items.push({ obj: t, y, center: true });
        y += t.height + 12;
      }
    });
    y += 12;
    const buttonWidth = Math.min(140, (wrap - (buttons.length - 1) * 10) / buttons.length);
    const made = buttons.map((b, i) => {
      const button = this.makeButton(b.label, b.action, { width: buttonWidth, primary: Boolean(b.primary) });
      const bx = (i - (buttons.length - 1) / 2) * (buttonWidth + 10);
      return { button, bx };
    });
    const ph = Math.min(h - 24, y + 42 + 40);
    const top = Math.max(12, (h - ph) / 2);
    const contentTop = top + 22;
    const bg = this.add.graphics();
    bg.fillStyle(0x08111b, 0.94); bg.fillRoundedRect(-pw / 2, 0, pw, ph, 16);
    bg.lineStyle(1, 0xa8c4de, 0.22); bg.strokeRoundedRect(-pw / 2, 0, pw, ph, 16);
    bg.setPosition(w / 2, top);
    this.overlay.add(bg);
    items.forEach(({ obj, y: iy, graphics }) => {
      if (graphics) obj.setPosition(w / 2, contentTop);
      else obj.setPosition(w / 2 + (obj.x || 0), contentTop + iy);
      this.overlay.add(obj);
    });
    this.medalCenter = medalY == null ? null : { x: w / 2, y: contentTop + medalY };
    made.forEach(({ button, bx }) => {
      button.setPosition(w / 2 + bx, top + ph - 34);
      this.overlay.add([button.bg, button.label]);
    });
    this.primaryAction = (buttons.find(b => b.primary) || buttons[0])?.action;
    this.lastPanel = { lines, buttons };
  }

  drawMedal(g, x, y, r, medal) {
    g.fillStyle(0x0b121a, 0.6); g.fillCircle(x + 1, y + 2, r);
    g.fillStyle(medal.color); g.fillCircle(x, y, r);
    g.lineStyle(Math.max(2, r * 0.12), 0xffffff, 0.45); g.strokeCircle(x, y, r * 0.78);
  }

  showMenu() {
    this.mode = 'menu';
    this.audio?.stopFlightSounds?.();
    this.progress = readLandingProgress();
    this.level = this.level || LANDING_LEVELS[0];
    this.resetAttempt();
    this.showPanel([
      { text: 'MISIÓN · RECUPERA EL PROPULSOR', size: 18, bold: true, color: '#8ff5c4' },
      { text: 'Haz volver la primera etapa y aterrízala de pie.\nCada aterrizaje desbloquea el siguiente.', color: '#aebdcb' },
      ...LANDING_LEVELS.map((level, i) => ({
        card: { level, index: i + 1, locked: !isLevelUnlocked(this.progress, level.id), best: this.progress.best[level.id] || 0 },
      })),
    ], [{ label: 'HANGAR', action: () => transitionTo(this, 'HangarScene'), primary: false }]);
    // Enter starts the newest open mission.
    const open = [...LANDING_LEVELS].reverse().find(l => isLevelUnlocked(this.progress, l.id));
    this.primaryAction = () => this.startLevel(open);
  }

  showBriefing() {
    this.mode = 'brief';
    const touch = this.controls.visible;
    const level = this.level;
    const best = this.progress.best[level.id];
    this.showPanel([
      { text: level.place.toUpperCase(), size: 11, bold: true, color: '#8fa8c0' },
      { text: level.title, size: 22, bold: true },
      { text: level.briefing, color: '#cfe0f0' },
      { text: touch ? 'IMPULSO para frenar · ◀ ▶ para inclinar' : 'ESPACIO / W para frenar · A / D para inclinar', color: '#8ff5c4', size: 13 },
      { text: `Toca a menos de ${LANDING.maxVerticalSpeed} m/s, centrado y casi vertical.\nEnciende al cruzar la línea naranja.${best ? `\nTu fantasma (${best}) vuela contigo.` : ''}`, color: '#8fa8c0', size: 12 },
    ], [
      { label: 'COMENZAR', action: () => this.fly(), primary: true },
      { label: 'MISIONES', action: () => this.showMenu(), primary: false },
    ]);
  }

  layout() {
    const { width: w, height: h } = this.scale;
    this.compact = w < 560;
    this.back.setPosition(w - 57, 24);
    this.controls.resize(w, h);
    this.groundY = h - (this.controls.visible ? (h < 480 ? 120 : 170) : 80);
    this.hint.setPosition(w / 2, this.groundY + (this.controls.visible ? 34 : 44)).setWordWrapWidth(w - 32);
    if (this.lastPanel && this.mode !== 'fly') {
      const primary = this.primaryAction;
      this.showPanel(this.lastPanel.lines, this.lastPanel.buttons);
      if (this.mode === 'menu') this.primaryAction = primary;
    }
  }

  // ---------- loop ----------

  update(time, delta) {
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;
    if (JD(k.ESC)) {
      if (this.mode === 'fly') this.pause();
      else this.leave();
    }
    if (JD(k.ENTER) && this.mode !== 'fly') this.primaryAction?.();
    if (JD(k.R) && (this.mode === 'done' || this.mode === 'paused')) { this.resetAttempt(); this.fly(); }

    const s = this.state;
    const dt = Math.min(delta / 1000, 0.1);
    if (this.mode === 'fly') {
      const left = k.A.isDown || k.LEFT.isDown || this.touch.left;
      const right = k.D.isDown || k.RIGHT.isDown || this.touch.right;
      const thrust = k.SPACE.isDown || k.W.isDown || k.UP.isDown || this.touch.thrust;
      this.accumulator += dt;
      while (this.accumulator >= STEP && !s.result) {
        stepLanding(s, STEP, { steer: Number(right) - Number(left), thrust }, this.level);
        this.accumulator -= STEP;
      }
      if (s.engineOn && this.burnStartAltitude == null && s.altitude < LANDING.startHeight - 30) this.burnStartAltitude = s.altitude;
      this.sample(false);
      if (s.result) this.finish();
    }
    this.updateAudio(s);
    this.updateParticles(s, dt);
    this.updateCamera(s, dt);
    this.drawScene(s, time, dt);
    this.drawHud(s, time);
    this.controls.update(s);
  }

  sample(force) {
    const s = this.state;
    const last = this.track[this.track.length - 1];
    if (force || !last || s.time - last[0] >= 0.2) {
      this.track.push([+s.time.toFixed(2), +s.x.toFixed(1), +s.altitude.toFixed(1), +s.angle.toFixed(3)]);
    }
  }

  updateAudio(s) {
    const a = this.audio;
    if (!a) return;
    if (this.mode === 'fly' && s.engineOn) {
      a.startEngine?.();
      a.updateEngine?.(1, 0);
    } else {
      a.stopEngine?.();
    }
    const flying = this.mode === 'fly';
    a.updateAtmosphere?.({ speed: flying ? Math.hypot(s.vx, s.vy) / 12 + Math.abs(s.wind) * 2 : 0, density: 1, heat: 0 });
  }

  // ---------- camera ----------

  updateCamera(s, dt) {
    const { width: w } = this.scale;
    const top = (this.hudBottom || (this.compact ? 182 : 100)) + 40;
    const usable = Math.max(120, this.groundY - top);
    const spread = Math.abs(s.x - s.padX);
    const fitHeight = usable / (s.altitude + BOOSTER_H + 20);
    const fitWidth = (w * 0.42) / Math.max(spread + PAD_SPAN * 0.6, PAD_SPAN);
    const maxScale = (usable * 0.42) / BOOSTER_H;
    const target = Math.min(fitHeight, fitWidth, maxScale);
    const targetX = Phaser.Math.Linear(s.padX, s.x, 0.5);
    if (!this.view.scale) {
      this.view.scale = target;
      this.view.x = targetX;
    } else {
      const k = Math.min(1, dt * 3);
      this.view.scale += (target - this.view.scale) * k;
      this.view.x += (targetX - this.view.x) * k;
    }
    this.view.shake = Math.max(0, this.view.shake - dt * 10);
  }

  toScreen(x, altitude) {
    const shake = this.view.shake;
    return {
      x: this.scale.width / 2 + (x - this.view.x) * this.view.scale + (shake ? (Math.random() - 0.5) * shake * 2 : 0),
      y: this.groundY - altitude * this.view.scale + (shake ? (Math.random() - 0.5) * shake * 2 : 0),
    };
  }

  // ---------- drawing ----------

  drawScene(s, time, dt) {
    const { width: w, height: h } = this.scale;
    const sky = SKIES[this.level.sky];
    const sc = this.view.scale;
    const g = this.sky.clear();
    g.fillGradientStyle(sky.top, sky.top, sky.bottom, sky.bottom, 1);
    g.fillRect(0, 0, w, this.groundY + 4);
    if (sky.stars) {
      this.stars.forEach((star, i) => {
        g.fillStyle(0xffffff, sky.stars * (0.4 + 0.6 * Math.abs(Math.sin(time * 0.001 + i))));
        g.fillCircle(star.x * w, star.y * this.groundY, star.r);
      });
    }

    // Distant coast with a little parallax; at sea it sits low on the horizon.
    const sea = this.level.surface === 'sea';
    const coastHeight = Math.min(h * (sea ? 0.07 : 0.16), 140);
    const painted = this.level.backdrop && this.textures.exists(this.level.backdrop);
    this.coast.setVisible(!painted).setTint(sky.coast).setDisplaySize(w * 1.6, coastHeight)
      .setPosition(w / 2 - this.view.x * 0.04 * sc, this.groundY + 2).setAlpha(sea ? 0.6 : 1);
    if (painted) {
      // Cover the sky; the painting keeps its proportions and drifts a little.
      if (this.backdrop.texture.key !== this.level.backdrop) this.backdrop.setTexture(this.level.backdrop);
      const art = this.backdrop.setVisible(true);
      const scale = Math.max((w * 1.1) / art.width, (this.groundY + 6) / art.height);
      art.setScale(scale).setPosition(w / 2 - this.view.x * 0.03 * sc, this.groundY + 6);
    } else {
      this.backdrop.setVisible(false);
    }

    const ground = this.ground.clear();
    ground.fillStyle(sky.ground); ground.fillRect(0, this.groundY, w, h - this.groundY);
    ground.fillStyle(sky.groundDark, 0.6);
    for (let y = this.groundY + 14, i = 0; y < h; y += 14 + i * 4, i++) ground.fillRect(0, y, w, 2);

    // Pad or ship. Their deck top is the model's altitude 0.
    const pad = this.toScreen(s.padX, 0);
    this.padImage.setVisible(!sea);
    this.shipImage.setVisible(sea);
    if (sea) {
      const width = PAD_SPAN * sc * (900 / 640);
      this.shipImage.setOrigin(0.5, 40 / 190).setDisplaySize(width, width * (190 / 900))
        .setPosition(pad.x, pad.y).setRotation(s.padRoll);
    } else {
      const width = PAD_SPAN * sc * (760 / 640);
      this.padImage.setOrigin(0.5, 10 / 70).setDisplaySize(width, width * (70 / 760)).setPosition(pad.x, pad.y);
    }

    const waves = this.sea.clear();
    if (sea) {
      const waterline = this.groundY + PAD_SPAN * sc * (80 / 640);
      waves.fillStyle(0x0d1d30, 0.95);
      waves.fillRect(0, waterline, w, h - waterline);
      waves.lineStyle(2, 0x6fc3e8, 0.35);
      for (let row = 0; row < 4; row++) {
        const y = waterline + 6 + row * 14;
        waves.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const yy = y + Math.sin(x * 0.03 + time * 0.002 * (1 + row * 0.3) + row) * (3 + row);
          if (x === 0) waves.moveTo(x, yy); else waves.lineTo(x, yy);
        }
        waves.strokePath();
      }
    }

    this.drawGuides(s, time);
    this.drawBooster(s, time, dt);
    this.drawParticles();
  }

  drawGuides(s, time) {
    const g = this.guides.clear();
    this.burnLabel.setVisible(false);
    const sc = this.view.scale;
    const flying = this.mode === 'fly' || this.mode === 'brief' || this.mode === 'paused';

    // Landing corridor above the deck centre.
    const pad = this.toScreen(s.padX, 0);
    g.lineStyle(1, GOOD, 0.3);
    for (let y = pad.y - 8; y > 90; y -= 18) g.lineBetween(pad.x, y, pad.x, y - 8);

    // Ghost of the best attempt: its path and where it was at this moment.
    if (this.ghost && this.mode !== 'menu') {
      g.lineStyle(1.5, 0xffffff, 0.18);
      g.beginPath();
      this.ghost.forEach(([, x, alt], i) => {
        const p = this.toScreen(x, alt);
        if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
      });
      g.strokePath();
      const at = this.ghost.find(sample => sample[0] >= s.time) || this.ghost[this.ghost.length - 1];
      const p = this.toScreen(at[1], at[2]);
      const gh = Math.max(BOOSTER_H * sc, 26);
      g.fillStyle(0xffffff, 0.22);
      g.fillRect(p.x - gh * 0.09, p.y - gh, gh * 0.18, gh);
    }

    // After the attempt: replay the path that was flown.
    if (this.mode === 'done' && this.track.length > 1) {
      g.lineStyle(2, s.result?.success ? GOOD : BAD, 0.6);
      g.beginPath();
      this.track.forEach(([, x, alt], i) => {
        const p = this.toScreen(x, alt);
        if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
      });
      g.strokePath();
      if (this.burnStartAltitude != null) {
        const sample = this.track.find(t => t[2] <= this.burnStartAltitude) || this.track[this.track.length - 1];
        const p = this.toScreen(sample[1], sample[2]);
        g.fillStyle(BURN); g.fillCircle(p.x, p.y, 5);
      }
    }

    if (!flying || s.result) return;

    // Burn line: start the full burn when the booster reaches it.
    const stopping = getStoppingHeight(s);
    if (s.vy < -LANDING.maxVerticalSpeed && s.fuelRemaining > 0.01) {
      const burnAlt = stopping + BURN_MARGIN;
      const p = this.toScreen(s.x, burnAlt);
      const urgent = s.altitude < burnAlt + 30;
      g.lineStyle(2, BURN, urgent ? 0.6 + 0.4 * Math.sin(time * 0.02) : 0.55);
      for (let x = p.x - 60; x < p.x + 60; x += 12) g.lineBetween(x, p.y, x + 7, p.y);
      this.burnLabel.setVisible(true).setPosition(p.x + 64, p.y + 6);
    }

    // Predicted touchdown point if nothing changes (engine off).
    const impactX = predictTouchdownX(s);
    const fall = (s.vy + Math.sqrt(s.vy * s.vy + 2 * LANDING.gravity * s.altitude)) / LANDING.gravity;
    const futurePad = this.level.ship ? s.padX + s.padVx * Math.min(fall, 2) : s.padX;
    const onPad = Math.abs(impactX - futurePad) + LANDING.legHalfWidth <= LANDING.padHalfWidth;
    const mark = this.toScreen(Phaser.Math.Clamp(impactX, this.view.x - 2000, this.view.x + 2000), 0);
    const color = onPad ? GOOD : BAD;
    g.fillStyle(color, 0.9);
    g.fillTriangle(mark.x, mark.y - 2, mark.x - 7, mark.y - 14, mark.x + 7, mark.y - 14);
    g.lineStyle(2, color, 0.6);
    g.strokeEllipse(mark.x, mark.y, 26, 8);

    // Wind sock.
    if (this.level.wind) {
      const x = 24;
      const y = (this.hudBottom || 100) + 16;
      const strength = Phaser.Math.Clamp(s.wind / this.level.wind, -1.5, 1.5);
      g.lineStyle(2, 0xcfe0f0, 0.8); g.lineBetween(x, y, x, y + 26);
      g.fillStyle(0xff8d7a, 0.9);
      const len = 8 + Math.abs(strength) * 18;
      const dir = Math.sign(strength) || 1;
      g.fillTriangle(x, y, x, y + 10, x + dir * len, y + 5 + (1 - Math.abs(strength) / 1.5) * 6);
    }
  }

  drawBooster(s, time, dt) {
    if (this.exploded) {
      this.booster.setVisible(false);
      return;
    }
    const sc = Math.max(this.view.scale, 26 / BOOSTER_H);
    const p = this.toScreen(s.x, s.altitude);
    this.booster.setPosition(p.x, p.y).setRotation(s.angle);
    this.boosterImage.setDisplaySize(BOOSTER_W * sc, BOOSTER_H * sc).setTint(s.result && !s.result.success ? 0x936254 : 0xffffff);

    // Legs unfold over the last stretch of the descent.
    const deployTarget = s.altitude < 160 || s.result?.success ? 1 : 0;
    this.legDeploy += (deployTarget - this.legDeploy) * Math.min(1, dt * 2.5);
    const legs = this.legs.clear();
    const d = Phaser.Math.Easing.Cubic.InOut(this.legDeploy);
    [-1, 1].forEach(side => {
      const px = side * 2.4 * sc;
      const py = -9 * sc;
      const fx = Phaser.Math.Linear(side * 2.4, side * LANDING.legHalfWidth, d) * sc;
      const fy = Phaser.Math.Linear(-20, 0.2, d) * sc;
      legs.lineStyle(Math.max(2, 1.1 * sc), 0x2a3138, 1);
      legs.lineBetween(px, py, fx, fy);
      legs.lineStyle(Math.max(1, 0.5 * sc), 0x7d8995, 1);
      legs.lineBetween(side * 2.4 * sc, -3 * sc, (px + fx) / 2, (py + fy) / 2);
      if (d > 0.5) {
        legs.fillStyle(0x3b434c);
        legs.fillRect(fx - 0.9 * sc, fy - 0.4 * sc, 1.8 * sc, 0.6 * sc);
      }
    });

    // Flame: a flickering core and a glowing outer plume.
    const flame = this.flame.clear();
    if (s.engineOn && this.mode === 'fly') {
      const flicker = 0.85 + Math.random() * 0.3;
      const len = (10 + Math.sin(time * 0.05) * 1.5) * sc * flicker;
      const half = 2.6 * sc;
      flame.fillStyle(0xff7a2a, 0.35); flame.fillEllipse(0, len * 0.45, half * 3.2, len * 1.2);
      flame.fillStyle(0xffa443, 0.85); flame.fillTriangle(-half, 0, half, 0, 0, len);
      flame.fillStyle(0xfff4dc, 1); flame.fillTriangle(-half * 0.5, 0, half * 0.5, 0, 0, len * 0.5);
    }
  }

  // ---------- particles (dust, debris, sparks) ----------

  spawn(p) {
    if (this.particles.length < 400) this.particles.push(p);
  }

  updateParticles(s, dt) {
    if (this.mode === 'fly' && s.engineOn && s.altitude < 70) {
      const strength = 1 - s.altitude / 70;
      const count = Math.ceil(strength * 6);
      for (let i = 0; i < count; i++) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.spawn({
          x: s.x + (Math.random() - 0.5) * 4, y: 0.5,
          vx: dir * (12 + Math.random() * 30) * strength, vy: Math.random() * 4,
          life: 1, decay: 0.5 + Math.random() * 0.6, size: 1.5 + Math.random() * 2.5,
          color: this.level.surface === 'sea' ? 0xdfefff : 0xc9b9a0, grow: 3,
        });
      }
    }
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y = Math.max(0, p.y + p.vy * dt);
      p.vy -= (p.gravity || 0) * dt;
      p.vx *= 1 - dt * 1.2;
      p.life -= p.decay * dt;
      p.size += (p.grow || 0) * dt;
      return p.life > 0;
    });
  }

  drawParticles() {
    const g = this.fx.clear();
    const sc = this.view.scale;
    this.particles.forEach(p => {
      const s = this.toScreen(p.x, p.y);
      g.fillStyle(p.color, Math.max(0, p.life) * (p.alpha ?? 0.55));
      g.fillCircle(s.x, s.y, Math.max(1.2, p.size * sc));
    });
  }

  explode() {
    const s = this.state;
    this.exploded = true;
    this.view.shake = 12;
    this.audio?.playExplosion?.();
    const colors = [0xff4500, 0xff8c00, 0xffd700, 0xfff4dc, 0x555555];
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI;
      const speed = 6 + Math.random() * 30;
      this.spawn({
        x: s.x, y: 2 + Math.random() * 10,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        gravity: 9, life: 1, decay: 0.35 + Math.random() * 0.5,
        size: 0.6 + Math.random() * 2.2, color: colors[i % colors.length], alpha: 0.9,
      });
    }
    for (let i = 0; i < 30; i++) {
      this.spawn({
        x: s.x + (Math.random() - 0.5) * 10, y: 3 + Math.random() * 8,
        vx: (Math.random() - 0.5) * 8, vy: 6 + Math.random() * 10,
        life: 1, decay: 0.35 + Math.random() * 0.25, size: 1.5 + Math.random() * 2, grow: 1.5,
        color: 0x3a3a3a, alpha: 0.28,
      });
    }
  }

  // ---------- HUD ----------

  drawHud(s, time) {
    const { width: w } = this.scale;
    const show = this.mode !== 'menu';
    [this.hudPanel, this.gauges, this.hudTitle, this.hudAltitude, this.hint]
      .forEach(o => o.setVisible(show));
    this.hudLabels.forEach(({ label, value }) => { label.setVisible(show); value.setVisible(show); });
    if (!show) return;

    const margin = 12;
    const pw = Math.min(w - margin * 2 - (this.compact ? 0 : 110), 760);
    const px = this.compact ? margin : Math.max(margin, (w - pw) / 2 - 40);
    const py = this.compact ? 50 : margin;
    const ph = 92;
    const panel = this.hudPanel.clear();
    panel.fillStyle(0x0b121a, 0.78); panel.fillRoundedRect(px, py, pw, ph, 12);
    panel.lineStyle(1, 0xa8c4de, 0.22); panel.strokeRoundedRect(px, py, pw, ph, 12);

    this.hudTitle.setText(`${LANDING_LEVELS.indexOf(this.level) + 1} · ${this.level.title.toUpperCase()}`).setPosition(px + 14, py + 10);
    this.hudAltitude.setText(`${Math.round(s.altitude)} m`).setPosition(px + 14, py + 28);

    const rel = s.vx - s.padVx;
    const tilt = Math.abs(s.angle - s.padRoll) * 180 / Math.PI;
    const fuelShare = s.fuelRemaining / s.fuel;
    const gauges = [
      { value: Math.max(0, -s.vy), limit: LANDING.maxVerticalSpeed, max: 25, text: `${Math.max(0, -s.vy).toFixed(1)} m/s` },
      { value: Math.abs(rel), limit: LANDING.maxHorizontalSpeed, max: 10, text: `${Math.abs(rel).toFixed(1)} m/s` },
      { value: tilt, limit: LANDING.maxAngle * 180 / Math.PI, max: 30, text: `${tilt.toFixed(0)}°` },
      { value: fuelShare, fuel: true, text: `${Math.round(fuelShare * 100)}%` },
    ];
    const gx = px + (this.compact ? 14 : 130);
    const gw = px + pw - 14 - gx;
    const gap = 12;
    const cols = !this.compact && (gw - gap * 3) / 4 >= 140 ? 4 : 2;
    const cw = (gw - gap * (cols - 1)) / cols;
    const gy0 = this.compact ? py + 64 : cols === 4 ? py + 34 : py + 12;
    const g = this.gauges.clear();
    if (this.compact) {
      panel.clear();
      panel.fillStyle(0x0b121a, 0.78); panel.fillRoundedRect(px, py, pw, ph + 40, 12);
      this.hudAltitude.setPosition(px + pw - 14, py + 8).setOrigin(1, 0);
    } else {
      this.hudAltitude.setOrigin(0, 0);
      if (cols === 4) {
        panel.clear();
        panel.fillStyle(0x0b121a, 0.78); panel.fillRoundedRect(px, py, pw, 72, 12);
        panel.lineStyle(1, 0xa8c4de, 0.22); panel.strokeRoundedRect(px, py, pw, 72, 12);
      }
    }
    this.hudBottom = this.compact ? py + ph + 40 : cols === 4 ? py + 72 : py + ph;
    gauges.forEach((gauge, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gx + col * (cw + gap);
      const y = gy0 + row * 40;
      let color;
      let share;
      if (gauge.fuel) {
        share = gauge.value;
        color = share < 0.2 ? BAD : share < 0.4 ? WARN : GOOD;
      } else {
        share = Math.min(1, gauge.value / gauge.max);
        const ratio = gauge.value / gauge.limit;
        // Descending fast is fine high up; only warn when it matters.
        const relaxed = i === 0 && s.altitude > getStoppingHeight(s) + BURN_MARGIN + 40;
        color = ratio < 0.75 || relaxed ? GOOD : ratio < 1 ? WARN : BAD;
      }
      const { label, value } = this.hudLabels[i];
      label.setPosition(x, y);
      value.setText(gauge.text).setPosition(x + cw, y).setColor(css(color));
      g.fillStyle(0x1d2a38); g.fillRoundedRect(x, y + 18, cw, 8, 4);
      g.fillStyle(color); g.fillRoundedRect(x, y + 18, Math.max(8, cw * share), 8, 4);
      if (!gauge.fuel) {
        const lx = x + cw * Math.min(1, gauge.limit / gauge.max);
        g.fillStyle(0xffffff, 0.8); g.fillRect(lx - 1, y + 15, 2, 14);
      }
    });

    // One clear instruction at a time.
    let hint = '';
    let hintColor = '#8ff5c4';
    if (this.mode === 'fly' && !s.result) {
      const stopping = getStoppingHeight(s);
      if (s.fuelRemaining <= 0.01) { hint = 'SIN COMBUSTIBLE'; hintColor = css(BAD); }
      else if (s.vy < -LANDING.maxVerticalSpeed && s.altitude < stopping + BURN_MARGIN) {
        hint = s.engineOn ? 'MANTÉN EL IMPULSO' : '¡ENCIENDE AHORA!';
        hintColor = css(Math.sin(time * 0.02) > 0 ? BAD : BURN);
      } else if (s.altitude < 40 && Math.abs(rel) > LANDING.maxHorizontalSpeed) {
        hint = rel > 0 ? '◀ FRENA LA DERIVA' : 'FRENA LA DERIVA ▶'; hintColor = css(WARN);
      } else if (s.altitude < 25 && tilt > LANDING.maxAngle * 180 / Math.PI) {
        hint = 'ENDEREZA EL PROPULSOR'; hintColor = css(WARN);
      } else if (s.altitude < 30) {
        hint = 'SUAVE…';
      } else if (s.altitude > stopping + BURN_MARGIN + 60) {
        const impact = predictTouchdownX(s) - s.padX;
        hint = Math.abs(impact) > LANDING.padHalfWidth - LANDING.legHalfWidth
          ? (impact > 0 ? '◀ INCLINA HACIA LA PLATAFORMA' : 'INCLINA HACIA LA PLATAFORMA ▶')
          : 'EN RUTA · ESPERA A LA LÍNEA NARANJA';
        hintColor = Math.abs(impact) > LANDING.padHalfWidth - LANDING.legHalfWidth ? css(WARN) : '#8ff5c4';
      }
    }
    this.hint.setText(hint).setColor(hintColor);
  }
}
