import { PARTS_BY_ID } from "../data/parts.js";
import ShipStatsCalculator from "./ShipStatsCalculator.js";

const ADJACENT_OFFSETS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function getKey(cellX, cellY) {
  return `${cellX},${cellY}`;
}

function getOccupiedCells(part) {
  const definition = PARTS_BY_ID[part.partId];
  if (!definition) {
    return [];
  }

  const cells = [];
  for (let offsetY = 0; offsetY < definition.gridHeight; offsetY += 1) {
    for (let offsetX = 0; offsetX < definition.gridWidth; offsetX += 1) {
      cells.push({
        cellX: part.cellX + offsetX,
        cellY: part.cellY + offsetY,
      });
    }
  }
  return cells;
}

export default class BuildValidator {
  static validate(parts) {
    const stats = ShipStatsCalculator.calculate(parts);
    const errors = [];
    const warnings = [];
    const issues = [];
    const cellsFor = (predicate) =>
      parts.filter(predicate).flatMap((part) => getOccupiedCells(part));
    const pushIssue = (severity, code, message, affectedCells = []) => {
      issues.push({ severity, code, message, affectedCells });
      if (severity === "error") {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    };

    if (parts.length === 0) {
      pushIssue("error", "empty", "Drag parts from the panel to start your rocket.");
      return { isValid: false, errors, warnings, issues, stats };
    }

    if (stats.cockpitCount === 0) {
      pushIssue("error", "no-cockpit", "Add exactly one cockpit to control the rocket.");
    } else if (stats.cockpitCount > 1) {
      pushIssue(
        "error",
        "multi-cockpit",
        "Use only one cockpit.",
        cellsFor((part) => PARTS_BY_ID[part.partId]?.type === "command"),
      );
    }

    if (stats.thrust <= 0 || stats.engineCount + stats.boosterCount === 0) {
      pushIssue("error", "no-thrust", "Add at least one engine or booster.");
    }

    if (stats.fuel <= 0) {
      pushIssue("error", "no-fuel", "Add fuel with a tank or a booster.");
    }

    if (stats.twr < 1.02) {
      pushIssue(
        "error",
        "low-thrust",
        "Thrust is too low. Add more engines or remove mass.",
        cellsFor((part) => {
          const type = PARTS_BY_ID[part.partId]?.type;
          return type === "engine" || type === "booster";
        }),
      );
    }

    const disconnectedCells = BuildValidator.findDisconnectedCells(parts);
    if (disconnectedCells.length > 0) {
      pushIssue(
        "error",
        "disconnected",
        "Every module must connect to the same rocket body.",
        disconnectedCells,
      );
    }

    const balanceOffset = stats.centerOfMassX - stats.centerX;
    if (Math.abs(balanceOffset) > 0.28) {
      const heavySide = Math.sign(balanceOffset) || 1;
      pushIssue(
        "warning",
        "mass-offset",
        "Center of mass is offset. The rocket may tumble.",
        cellsFor((part) => {
          const definition = PARTS_BY_ID[part.partId];
          const partCenterX = part.cellX + definition.gridWidth / 2;
          return Math.sign(partCenterX - stats.centerX) === heavySide;
        }),
      );
    }

    if (stats.width > 3) {
      pushIssue(
        "warning",
        "wide-stack",
        "Wide stacks are harder to stabilize in flight.",
        cellsFor(
          (part) => {
            const definition = PARTS_BY_ID[part.partId];
            return (
              part.cellX === stats.bounds.minX ||
              part.cellX + definition.gridWidth === stats.bounds.maxX
            );
          },
        ),
      );
    }

    if (stats.stability < 0.48 && parts.length > 2) {
      pushIssue(
        "warning",
        "low-stability",
        "Stability is low. Recenter mass or add an avionics module.",
        parts.flatMap((part) => getOccupiedCells(part)),
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      issues,
      stats,
    };
  }

  static areAllPartsConnected(parts) {
    return BuildValidator.findDisconnectedCells(parts).length === 0;
  }

  static findDisconnectedCells(parts) {
    if (parts.length <= 1) {
      return [];
    }

    const occupiedCells = parts.flatMap((part) => getOccupiedCells(part));
    const cells = new Set(
      occupiedCells.map((cell) => getKey(cell.cellX, cell.cellY)),
    );
    const commandPart = parts.find(
      (part) => PARTS_BY_ID[part.partId]?.type === "command",
    );
    const visited = new Set();
    const queue = getOccupiedCells(commandPart || parts[0]);

    while (queue.length > 0) {
      const cell = queue.shift();
      const key = getKey(cell.cellX, cell.cellY);

      if (visited.has(key)) {
        continue;
      }

      visited.add(key);

      ADJACENT_OFFSETS.forEach((offset) => {
        const nextKey = getKey(cell.cellX + offset.x, cell.cellY + offset.y);
        if (cells.has(nextKey) && !visited.has(nextKey)) {
          queue.push({
            cellX: cell.cellX + offset.x,
            cellY: cell.cellY + offset.y,
          });
        }
      });
    }

    return occupiedCells.filter((cell) => !visited.has(getKey(cell.cellX, cell.cellY)));
  }
}
