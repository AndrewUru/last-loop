import { PARTS_BY_ID } from "../data/parts.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default class ShipStatsCalculator {
  static calculate(parts) {
    const resolvedParts = parts
      .map((part) => ({
        ...part,
        definition: PARTS_BY_ID[part.partId],
      }))
      .filter((part) => Boolean(part.definition));

    if (resolvedParts.length === 0) {
      return {
        partCount: 0,
        mass: 0,
        fuel: 0,
        thrust: 0,
        fuelUse: 0,
        twr: 0,
        balanceScore: 0,
        stability: 0,
        width: 0,
        height: 0,
        bounds: null,
        centerX: 0,
        engineCount: 0,
        boosterCount: 0,
        cockpitCount: 0,
        tankCount: 0,
      };
    }

    const commandPart = resolvedParts.find(
      (part) => part.definition.type === "command",
    );
    const centerX = commandPart
      ? commandPart.cellX + commandPart.definition.gridWidth / 2
      : resolvedParts.reduce(
          (sum, part) => sum + part.cellX + part.definition.gridWidth / 2,
          0,
        ) / resolvedParts.length;

    let mass = 0;
    let fuel = 0;
    let thrust = 0;
    let fuelUse = 0;
    let weightedX = 0;
    let weightedY = 0;
    let weightedOffset = 0;
    let weightedThrustOffset = 0;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let engineCount = 0;
    let boosterCount = 0;
    let cockpitCount = 0;
    let tankCount = 0;

    resolvedParts.forEach((part) => {
      const { definition } = part;
      const partCenterX = part.cellX + definition.gridWidth / 2;
      const partCenterY = part.cellY + definition.gridHeight / 2;

      mass += definition.mass;
      fuel += definition.fuel;
      thrust += definition.thrust;
      fuelUse += definition.fuelUse;
      weightedX += partCenterX * definition.mass;
      weightedY += partCenterY * definition.mass;
      weightedOffset += (partCenterX - centerX) * definition.mass;
      weightedThrustOffset += (partCenterX - centerX) * definition.thrust;
      minX = Math.min(minX, part.cellX);
      maxX = Math.max(maxX, part.cellX + definition.gridWidth);
      minY = Math.min(minY, part.cellY);
      maxY = Math.max(maxY, part.cellY + definition.gridHeight);

      if (definition.type === "engine") {
        engineCount += 1;
      } else if (definition.type === "booster") {
        boosterCount += 1;
      } else if (definition.type === "command") {
        cockpitCount += 1;
      } else if (definition.type === "fuel") {
        tankCount += 1;
      }
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const massOffsetPenalty = Math.abs(weightedOffset) / Math.max(mass, 1);
    const thrustOffsetPenalty = Math.abs(weightedThrustOffset) / Math.max(thrust || 1, 1);
    const footprintPenalty = Math.max(0, width - 3) * 0.07 + Math.max(0, height - 7) * 0.03;
    const rawBalance = 1 - massOffsetPenalty * 0.65 - thrustOffsetPenalty * 0.9;
    const rawStability = rawBalance - footprintPenalty;

    return {
      partCount: resolvedParts.length,
      mass,
      fuel,
      thrust,
      fuelUse,
      centerOfMassX: weightedX / Math.max(mass, 1),
      centerOfMassY: weightedY / Math.max(mass, 1),
      twr: thrust / Math.max(mass, 1),
      balanceScore: clamp(rawBalance, 0, 1),
      stability: clamp(rawStability, 0, 1),
      width,
      height,
      bounds: { minX, maxX, minY, maxY },
      centerX,
      engineCount,
      boosterCount,
      cockpitCount,
      tankCount,
    };
  }
}
