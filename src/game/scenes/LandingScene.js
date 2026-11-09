import Phaser from 'phaser';
import { LANDING, createLandingState, stepLanding } from '../systems/LandingModel.js';
import FlightTouchControls from '../ui/FlightTouchControls.js';
import { addText } from '../ui/theme.js';

const BEST_KEY = 'last-loop-landing-best-v1';
export default class LandingScene extends Phaser.Scene {
  constructor() { super({ key: 'LandingScene' }); }

  create() {
    this.state = createLandingState();
    this.started = false;
    this.finished = false;
    this.paused = false;
    this.accumulator = 0;
    this.touch = { left: false, right: false, thrust: false };
    this.cameras.main.setBackgroundColor(0x081725);
    this.world = this.add.graphics();
    this.hud = addText(this, 16, 56, '', { size: 15, lineSpacing: 5 }).setDepth(10);
    this.title = addText(this, 16, 16, 'FALCON 9 · ATERRIZAJE', { size: 16, bold: true });
    this.hint = addText(this, 0, 0, '', { size: 14, align: 'center', color: '#8ff5c4' }).setOrigin(0.5).setDepth(10);
    this.keys = this.input.keyboard.addKeys('SPACE,W,UP,A,D,LEFT,RIGHT,ESC,ENTER,R');
    this.controls = new FlightTouchControls(this, {
      onSteerLeft: value => { this.touch.left = value; },
      onSteerRight: value => { this.touch.right = value; },
      onThrust: value => { this.touch.thrust = value; },
    });
    this.controls.create();
    this.back = this.button('HANGAR', () => this.scene.start('HangarScene'));
    this.action = this.button('COMENZAR', () => this.activate());
    this.message = addText(this, 0, 0, '', { size: 17, align: 'center', lineSpacing: 8 }).setOrigin(0.5).setDepth(61);
    this.panel = this.add.rectangle(0, 0, 1, 1, 0x08111b, 0.97).setDepth(60);
    this.message.setText('RECUPERA EL PROPULSOR\n\nImpulso: ESPACIO / W / ↑\nInclinación: A / D o ← / →\nEn móvil, usa los botones inferiores.\n\nToca a menos de 4 m/s, centrado\ny casi vertical. Conserva combustible.');
    const blur = () => {
      if (this.started && !this.finished) {
        this.paused = true;
        this.touch = { left: false, right: false, thrust: false };
        this.controls.buttons.forEach(button => button.setActive(false));
        this.input.keyboard.resetKeys();
        this.message.setText('ENTRENAMIENTO EN PAUSA');
        this.action.label.setText('CONTINUAR');
        this.showPanel(true);
      }
    };
    this.game.events.on(Phaser.Core.Events.BLUR, blur);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      this.game.events.off(Phaser.Core.Events.BLUR, blur);
      this.scale.off('resize', this.layout, this);
    });
    this.layout();
    this.showPanel(true);
  }

  button(label, callback) {
    const bg = this.add.rectangle(0, 0, 140, 42, 0x205443).setStrokeStyle(1, 0x73f7c0)
      .setInteractive({ useHandCursor: true }).setDepth(62);
    const text = addText(this, 0, 0, label, { size: 13, bold: true }).setOrigin(0.5).setDepth(63);
    bg.on('pointerdown', callback);
    return { bg, label: text };
  }

  layout() {
    const { width: w, height: h } = this.scale;
    this.title.setFontSize(w < 480 ? 12 : 16);
    this.back.bg.setPosition(w - 57, 22).setSize(98, 36);
    this.back.label.setPosition(w - 57, 22);
    this.hud.setFontSize(w < 400 ? 13 : 15);
    this.controls.resize(w, h);
    this.hint.setPosition(w / 2, h - (this.controls.visible ? 130 : 30)).setWordWrapWidth(w - 32);
    const panelHeight = Math.min(350, h - 100);
    this.panel.setPosition(w / 2, h / 2).setSize(Math.min(w - 24, 440), panelHeight);
    this.message.setPosition(w / 2, h / 2 - 26).setFontSize(h < 500 ? 12 : 16).setWordWrapWidth(Math.min(w - 48, 400));
    this.action.bg.setPosition(w / 2, h / 2 + panelHeight / 2 - 32);
    this.action.label.setPosition(this.action.bg.x, this.action.bg.y);
  }

  showPanel(visible) {
    [this.panel, this.message, this.action.bg, this.action.label].forEach(o => o.setVisible(visible));
    this.action.bg.input.enabled = visible;
    this.controls.buttons.forEach(b => { b.background.input.enabled = !visible; });
  }

  activate() {
    if (this.finished) return this.scene.restart();
    this.started = true;
    this.paused = false;
    this.accumulator = 0;
    this.showPanel(false);
  }

  update(time, delta) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) return this.scene.start('HangarScene');
    if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) && (!this.started || this.paused || this.finished)) this.activate();
    if (Phaser.Input.Keyboard.JustDown(this.keys.R) && this.finished) this.scene.restart();
    const s = this.state;
    if (this.started && !this.paused && !this.finished) {
      const left = this.keys.A.isDown || this.keys.LEFT.isDown || this.touch.left;
      const right = this.keys.D.isDown || this.keys.RIGHT.isDown || this.touch.right;
      const thrust = this.keys.SPACE.isDown || this.keys.W.isDown || this.keys.UP.isDown || this.touch.thrust;
      this.accumulator += Math.min(delta / 1000, 0.1);
      while (this.accumulator >= 1 / 120 && !s.result) {
        stepLanding(s, 1 / 120, { steer: Number(right) - Number(left), thrust });
        this.accumulator -= 1 / 120;
      }
      if (s.result) this.finish();
    }
    this.drawWorld(time);
    this.controls.update(s);
    this.hud.setText(`ALTITUD  ${s.altitude.toFixed(0)} m   ·   ${s.time.toFixed(1)} s\nDESCENSO  ${Math.max(0, -s.vy).toFixed(1)} m/s   ·   LATERAL  ${Math.abs(s.vx).toFixed(1)} m/s\nCOMBUSTIBLE  ${Math.round(s.fuelRemaining / LANDING.fuel * 100)}%`);
    const stopping = s.vy < 0 ? s.vy * s.vy / (2 * (LANDING.thrust * Math.cos(s.angle) - LANDING.gravity)) : 0;
    this.hint.setText(this.finished ? '' : s.fuelRemaining <= 0 ? 'SIN COMBUSTIBLE' : s.altitude < stopping + 35 && s.vy < -4 ? '¡FRENA! Mantén IMPULSO' : 'Centro de la plataforma · vertical · menos de 4 m/s');
  }

  drawWorld(time) {
    const { width: w, height: h } = this.scale;
    const s = this.state;
    const ground = h - (this.controls.visible ? (h < 480 ? 110 : 160) : 70);
    const usable = Math.max(80, ground - 160);
    const scale = Math.min(usable / Math.max(200, s.altitude + 65), w / 240);
    const cx = w / 2;
    const g = this.world.clear();
    g.fillStyle(0x102b3b); g.fillRect(0, ground + 10, w, h - ground);
    g.lineStyle(1, 0x264452, 0.7);
    for (let y = ground + 24; y < h; y += 24) g.lineBetween(0, y, w, y);
    // Dashed landing corridor and a platform expressed in the same units as collisions.
    g.lineStyle(1, 0x73f7c0, 0.25);
    for (let y = 150; y < ground; y += 16) g.lineBetween(cx, y, cx, y + 7);
    const padWidth = LANDING.padHalfWidth * 2 * scale;
    g.fillStyle(0x344b59); g.fillRect(cx - padWidth / 2, ground, padWidth, 10);
    g.lineStyle(3, 0x73f7c0); g.lineBetween(cx - padWidth / 2, ground, cx + padWidth / 2, ground);
    g.lineStyle(2, 0xffd166); g.strokeCircle(cx, ground + 5, Math.max(3, padWidth * 0.12));
    const x = cx + s.x * scale;
    const y = ground - s.altitude * scale;
    // First-stage silhouette, with legs; no payload or second-stage artwork.
    const bodyScale = Math.max(0.55, scale);
    g.save(); g.translateCanvas(x, y); g.rotateCanvas(s.angle); g.scaleCanvas(bodyScale, bodyScale);
    if (s.engineOn) {
      g.fillStyle(0xffa443, 0.8); g.fillTriangle(-3, -4, 3, -4, 0, 20 + Math.sin(time * 0.05) * 5);
      g.fillStyle(0xfff4dc); g.fillTriangle(-1.5, -4, 1.5, -4, 0, 10);
    }
    g.fillStyle(s.result && !s.result.success ? 0x936254 : 0xd8e4ed); g.fillRoundedRect(-4, -48, 8, 43, 2);
    g.fillStyle(0x263748); g.fillRect(-4, -44, 8, 6); g.fillRect(-4, -13, 8, 8);
    g.lineStyle(2, 0xaac4d5); g.lineBetween(-3, -15, -9, 0); g.lineBetween(3, -15, 9, 0);
    g.restore();
  }

  finish() {
    this.finished = true;
    const { result } = this.state;
    let best = result.score;
    try {
      best = Math.max(Number(localStorage.getItem(BEST_KEY)) || 0, result.score);
      if (result.success) localStorage.setItem(BEST_KEY, String(best));
    } catch { /* Storage can be unavailable; the attempt remains playable. */ }
    this.registry.get('audio')?.[result.success ? 'playSuccess' : 'playError']?.();
    this.message.setText(result.success
      ? `¡ATERRIZAJE CONSEGUIDO!\n\n${result.score} / 1000 puntos\nPrecisión: ${result.parts.precision} / 400\nSuavidad: ${result.parts.softness} / 400\nCombustible: ${result.parts.fuel} / 200\n\nMejor marca: ${best}`
      : `ATERRIZAJE FALLIDO\n\n${result.reason}\n\nDescenso: ${Math.abs(this.state.vy).toFixed(1)} m/s\nLateral: ${Math.abs(this.state.vx).toFixed(1)} m/s`);
    this.action.label.setText('REINTENTAR');
    this.showPanel(true);
  }
}
