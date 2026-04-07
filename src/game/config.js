import Phaser from "phaser";

export default {
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#040d16",
  transparent: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
};
