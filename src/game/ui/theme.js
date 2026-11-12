// Shared look for every screen: one font, one panel style, one palette.
export const UI_FONT = '"Segoe UI", "Trebuchet MS", Roboto, "Helvetica Neue", Arial, sans-serif';

export const UI_COLORS = {
  background: 0x08111b,
  panel: 0x0f1a26,
  panelEdge: 0xa8c4de,
  rowHover: 0x18283a,
  accent: 0x73f7c0,
  accentText: "#8ff5c4",
  warning: 0xffd166,
  warningText: "#ffd166",
  danger: 0xff8d7a,
  dangerText: "#ff9b8a",
  info: 0x68d9ff,
  text: "#f3f7fb",
  textMuted: "#93a9bf",
  textDim: "#5f7489",
};

export function addText(scene, x, y, text, { size = 16, color = UI_COLORS.text, bold = false, ...style } = {}) {
  return scene.add.text(x, y, text, {
    fontFamily: UI_FONT,
    fontSize: `${size}px`,
    color,
    fontStyle: bold ? "bold" : "normal",
    ...style,
  });
}

// One decimal, so a time just under a challenge limit never rounds up to it.
export function formatSeconds(seconds) {
  return `${seconds.toFixed(1).replace(".", ",")} s`;
}

export function drawPanel(graphics, x, y, width, height, { radius = 14, alpha = 0.85, edgeAlpha = 0.22 } = {}) {
  graphics.fillStyle(UI_COLORS.panel, alpha);
  graphics.fillRoundedRect(x, y, width, height, radius);
  graphics.lineStyle(1, UI_COLORS.panelEdge, edgeAlpha);
  graphics.strokeRoundedRect(x, y, width, height, radius);
}

// A small "SONIDO: SÍ / NO" button, anchored at its top-right corner. The M
// key toggles the sound too (see main.js), so the label follows the audio
// system rather than its own clicks.
export function addSoundToggle(scene, x, y, { size = 13, padding = { x: 10, y: 12 } } = {}) {
  const audio = scene.registry.get("audio");
  const label = () => (audio?.muted ? "SONIDO: NO" : "SONIDO: SÍ");
  const button = addText(scene, x, y, label(), {
    size,
    bold: true,
    color: UI_COLORS.textMuted,
    backgroundColor: "#12202e",
    padding,
  })
    .setOrigin(1, 0)
    .setInteractive({ useHandCursor: true });
  const refresh = () => button.setText(label()).setColor(audio?.muted ? UI_COLORS.textDim : UI_COLORS.textMuted);
  button.on("pointerdown", () => {
    audio?.resume?.();
    scene.game.events.emit("toggle-mute");
    audio?.playClick?.();
  });
  scene.game.events.on("mute-changed", refresh);
  scene.events.once("shutdown", () => scene.game.events.off("mute-changed", refresh));
  refresh();
  return button;
}
