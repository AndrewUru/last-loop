// Artwork shared by several screens, as texture keys and files. Sources live
// in art/ and are turned into these with tools/prepare_art.py.
export const ART = {
  // The whole planet including its painted halo; the halo adds this share to
  // the radius, so it is drawn a touch larger than the planet itself.
  earth: { key: "world-earth", path: "assets/world/earth.webp", haloScale: 1.04 },
  // Side view with its access arms pointing right, towards the rocket.
  launchTower: { key: "world-launch-tower", path: "assets/world/launch-tower.webp" },
};
