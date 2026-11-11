import Phaser from "phaser";

// Retro console artwork for panels, buttons, bars and badges. Sources live in
// art/incoming/ui/ (see docs/ui-assets.md); the game loads the WebP copies in
// public/assets/ui/. Stretchable pieces carry their nine-slice margin.
const SLICED = {
  "panel-hud": 24,
  "panel-large": 32,
  "panel-card": 24,
  "panel-radio": 24,
  "bar-frame": 12,
  "bar-fill": 8,
  ...Object.fromEntries(
    ["primary", "secondary", "danger"].flatMap((button) =>
      ["idle", "pressed", "disabled"].map((state) => [`btn-${button}-${state}`, 28]),
    ),
  ),
};

const BUTTONS = ["primary", "secondary", "danger", "round-blue", "round-amber", "round-red"];
const STATES = ["idle", "pressed", "disabled"];

const FILES = [...new Set([
  ...Object.keys(SLICED),
  ...BUTTONS.flatMap((button) => STATES.map((state) => `btn-${button}-${state}`)),
  "lamp-off",
  "lamp-on",
  "gauge-dial",
  "gauge-needle",
  "badge-frame",
  "badge-locked",
  "rank-cadete",
  "rank-piloto",
  "rank-comandante",
  "rank-veterano",
  "rank-leyenda",
  "scanlines",
])];

export const uiKey = (name) => `ui-${name}`;

export function loadConsoleArt(load) {
  FILES.forEach((name) => load.image(uiKey(name), `assets/ui/${name}.webp`));
}

export function filterConsoleArt(textures) {
  FILES.forEach((name) => textures.get(uiKey(name)).setFilter(Phaser.Textures.FilterMode.LINEAR));
}

// Nine-slice pieces are WebGL only; on the canvas renderer the screens keep
// their plain drawn look.
export function hasConsoleArt(scene, name) {
  if (name in SLICED && scene.sys.game.renderer.type !== Phaser.WEBGL) return false;
  return scene.textures.exists(uiKey(name));
}

// A stretchable piece drawn at `scale` of its source size. Its corners keep
// their proportions; setSlicedSize() resizes it in screen pixels.
export function addSliced(scene, name, { scale = 1 } = {}) {
  const margin = SLICED[name];
  const source = scene.textures.get(uiKey(name)).getSourceImage();
  const piece = scene.add
    .nineslice(0, 0, uiKey(name), undefined, source.width, source.height, margin, margin, margin, margin)
    .setOrigin(0)
    .setScale(scale);
  piece.minSourceSize = margin * 2;
  return piece;
}

export function setSlicedSize(piece, width, height) {
  const scale = piece.scaleX;
  piece.setSize(Math.max(piece.minSourceSize, width / scale), Math.max(piece.minSourceSize, height / scale));
  return piece;
}

export function rankKey(title) {
  return uiKey(`rank-${title.toLowerCase()}`);
}
