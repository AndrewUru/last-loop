import Phaser from "phaser";
import BootScene from "./game/scenes/BootScene.js";
import HangarScene from "./game/scenes/HangarScene.js";
import FlightScene from "./game/scenes/FlightScene.js";
import LandingScene from "./game/scenes/LandingScene.js";
import config from "./game/config.js";
import { installFx } from "./game/fx/Fx.js";

config.scene = [BootScene, HangarScene, FlightScene, LandingScene];

const game = new Phaser.Game(config);
installFx(game);

if (import.meta.env.DEV) {
  // Handy for poking at scenes from the browser console while developing.
  window.__game = game;
}
