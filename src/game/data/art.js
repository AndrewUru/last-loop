// Artwork shared by several screens, as texture keys and files. Sources live
// in art/ and are turned into these with tools/prepare_art.py (cut-outs) and
// tools/prepare_backdrops.py (painted backdrops and the second cumulus).
export const ART = {
  // The whole planet including its painted halo; the halo adds this share to
  // the radius, so it is drawn a touch larger than the planet itself.
  earth: { key: "world-earth", path: "assets/world/earth.webp", haloScale: 1.04 },
  // Side view with its access arms pointing right, towards the rocket.
  launchTower: { key: "world-launch-tower", path: "assets/world/launch-tower.webp" },
  // The hangar backdrop. Points are shares of the image size: the centre of
  // the pedestal's top (where the chosen rocket stands), the floor in front
  // of the side gantries (where its neighbours stand) and their x.
  hangar: {
    key: "world-hangar",
    path: "assets/world/hangar.webp",
    pedestal: { x: 0.425, y: 0.728 },
    bays: { left: 0.165, right: 0.66, floor: 0.74 },
  },
  // Clouds with flat bases at the bottom of the image and soft edges.
  cloudCumulus: { key: "world-cloud-cumulus", path: "assets/world/cloud-cumulus.webp" },
  cloudStratus: { key: "world-cloud-stratus", path: "assets/world/cloud-stratus.webp" },
  cloudStorm: { key: "world-cloud-storm", path: "assets/world/cloud-storm.webp" },
  cloudCumulus2: { key: "world-cloud-cumulus-2", path: "assets/world/cloud-cumulus-2.webp" },
  // Horizon band of the coastal spaceport: hills, towers, sea and scrub, with
  // the sky and foreground faded out. horizon: the sea line as a share of the
  // height; towerShare: a tower's height as a share of the image width.
  coastPanorama: {
    key: "world-coast-panorama",
    path: "assets/world/coast-panorama.webp",
    horizon: 0.474,
    towerShare: 0.037,
  },
};
