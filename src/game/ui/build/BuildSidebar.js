export function createBuildControls(scene) {
  scene.launchButton = scene.createButton(
    scene.layout.launchButtonX,
    scene.layout.launchButtonY,
    scene.layout.sideButtonWidth,
    scene.layout.sideButtonHeight,
    "Launch",
    "#0c281f",
    "#73f7c0",
    () => {
      scene.launchRocket();
    },
  );
  scene.clearButton = scene.createButton(
    scene.layout.launchButtonX,
    scene.layout.launchButtonY +
      scene.layout.sideButtonHeight +
      scene.layout.sideButtonGap,
    scene.layout.sideButtonWidth,
    scene.layout.sideButtonHeight,
    "Clear Build",
    "#261114",
    "#ff8d8d",
    () => {
      scene.clearBuild();
    },
  );
  scene.removeButton = scene.createButton(
    scene.layout.launchButtonX,
    scene.layout.launchButtonY +
      (scene.layout.sideButtonHeight + scene.layout.sideButtonGap) * 2,
    scene.layout.sideButtonWidth,
    scene.layout.sideButtonHeight,
    "Remove Selected",
    "#231c0b",
    "#ffd773",
    () => scene.removeSelectedPart(),
  );

  scene.removeButton.setDisabled(true);
}

export function createBuildStatsPanel(scene) {
  const {
    rightTextX: x,
    statsTitleY,
    statsBodyY,
    validationTitleY,
    validationBodyY,
    focusTitleY,
    focusBodyY,
    rightWrapWidth,
    compactUi,
  } = scene.layout;

  scene.add.text(x, statsTitleY, "Current stack", {
    fontSize: compactUi ? "17px" : "18px",
    color: "#8fd7ff",
  });
  scene.statsText = scene.add.text(x, statsBodyY, "", {
    fontSize: compactUi ? "16px" : "18px",
    color: "#effcff",
    lineSpacing: compactUi ? 9 : 12,
  });
  scene.add.text(x, validationTitleY, "Launch check", {
    fontSize: compactUi ? "17px" : "18px",
    color: "#8fd7ff",
  });
  scene.validationText = scene.add.text(x, validationBodyY, "", {
    fontSize: compactUi ? "14px" : "16px",
    color: "#bfdff4",
    wordWrap: { width: rightWrapWidth },
    lineSpacing: compactUi ? 6 : 8,
  });
  scene.add.text(x, focusTitleY, "Focused module", {
    fontSize: compactUi ? "17px" : "18px",
    color: "#8fd7ff",
  });
  scene.focusTitleText = scene.add.text(x, focusBodyY, "Hover a part", {
    fontSize: compactUi ? "17px" : "18px",
    color: "#effcff",
    fontStyle: "bold",
  });
  scene.focusBodyText = scene.add.text(x, focusBodyY + 30, "", {
    fontSize: compactUi ? "13px" : "14px",
    color: "#bfdff4",
    wordWrap: { width: rightWrapWidth },
    lineSpacing: compactUi ? 6 : 7,
  });
}
