import Phaser from "phaser";

function getInitialGameSize() {
  if (typeof document !== "undefined") {
    const container = document.getElementById("game-container");
    if (container) {
      return {
        width: container.clientWidth || window.innerWidth,
        height: container.clientHeight || window.innerHeight,
      };
    }
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

const initialSize = getInitialGameSize();

export default {
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#edf2f8",
  transparent: true,
  fps: {
    target: 60,
    min: 30,
    forceSetTimeOut: false,
  },
  input: {
    activePointers: 3,
  },
  render: {
    antialias: false,
    powerPreference: "high-performance",
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: initialSize.width,
    height: initialSize.height,
  },
};
