// sensors.ts -- Segel-Sensorik
// Alle Sensoren liefern Werte in 0.0..1.0. Winkel werden als sin/cos-Paare
// kodiert, um die Unstetigkeit am Wraparound zu vermeiden.

import { Indiv, Sensor, Coord } from './types';
import { Grid } from './grid';
import { Peeps } from './peeps';
import { Signals } from './signals';
import { SimParams } from './params';
import { randomFloat } from './random';
import { sailingEnv, compassAngleRad, currentObjective } from './sailing';

// Reichweite des Hindernis-Probes voraus
const OBSTACLE_PROBE_DIST = 8;

// Reusable Coord für den Probe (kein GC-Druck im Hot Path)
const _probe = new Coord(0, 0);

// ---------------------------------------------------------------------------
// getSensor -- main entry point
// ---------------------------------------------------------------------------

export function getSensor(
  indiv: Indiv,
  sensorNum: Sensor,
  simStep: number,
  grid: Grid,
  _peeps: Peeps,
  _signals: Signals,
  params: SimParams,
): number {
  let sensorVal = 0.0;

  switch (sensorNum) {
    case Sensor.WIND_REL_X:
    case Sensor.WIND_REL_Y: {
      // Windwinkel relativ zum Heading: 0 = Wind genau von vorn (No-Go-Zone)
      const rel = compassAngleRad(sailingEnv.windFrom) - compassAngleRad(indiv.heading.dir9);
      const v = sensorNum === Sensor.WIND_REL_X ? Math.cos(rel) : Math.sin(rel);
      sensorVal = (v + 1.0) / 2.0;
      break;
    }

    case Sensor.TARGET_REL_X:
    case Sensor.TARGET_REL_Y: {
      const center = currentObjective(
        indiv.challengeBits, sailingEnv.targetQuadrant, params.courseLegs, params.sizeX, params.sizeY,
      );
      const dx = center.x - indiv.loc.x;
      const dy = center.y - indiv.loc.y;
      if (dx === 0 && dy === 0) {
        sensorVal = 0.5;
        break;
      }
      const rel = Math.atan2(dy, dx) - compassAngleRad(indiv.heading.dir9);
      const v = sensorNum === Sensor.TARGET_REL_X ? Math.cos(rel) : Math.sin(rel);
      sensorVal = (v + 1.0) / 2.0;
      break;
    }

    case Sensor.TARGET_DIST: {
      const center = currentObjective(
        indiv.challengeBits, sailingEnv.targetQuadrant, params.courseLegs, params.sizeX, params.sizeY,
      );
      const dx = center.x - indiv.loc.x;
      const dy = center.y - indiv.loc.y;
      const maxDist = Math.sqrt(params.sizeX * params.sizeX + params.sizeY * params.sizeY);
      sensorVal = Math.sqrt(dx * dx + dy * dy) / maxDist;
      break;
    }

    case Sensor.OBSTACLE_FWD: {
      const nc = indiv.heading.asNormalizedCoord();
      let free = 0;
      let cx = indiv.loc.x;
      let cy = indiv.loc.y;
      for (let i = 0; i < OBSTACLE_PROBE_DIST; i++) {
        cx += nc.x;
        cy += nc.y;
        _probe.x = cx;
        _probe.y = cy;
        if (!grid.isInBounds(_probe) || grid.isBarrierAt(_probe)) break;
        free++;
      }
      sensorVal = free / OBSTACLE_PROBE_DIST;
      break;
    }

    case Sensor.BOUNDARY_DIST: {
      const distX = Math.min(indiv.loc.x, (params.sizeX - indiv.loc.x) - 1);
      const distY = Math.min(indiv.loc.y, (params.sizeY - indiv.loc.y) - 1);
      const closest = Math.min(distX, distY);
      const maxPossible = Math.max(
        Math.floor(params.sizeX / 2) - 1,
        Math.floor(params.sizeY / 2) - 1,
      );
      sensorVal = maxPossible > 0 ? closest / maxPossible : 0;
      break;
    }

    case Sensor.SPEED:
      sensorVal = indiv.speedEMA;
      break;

    case Sensor.OSC1: {
      const phase = (simStep % indiv.oscPeriod) / indiv.oscPeriod;
      let factor = -Math.cos(phase * 2.0 * Math.PI);
      factor = (factor + 1.0) / 2.0;
      sensorVal = Math.min(1.0, Math.max(0.0, factor));
      break;
    }

    case Sensor.AGE:
      sensorVal = indiv.age / params.stepsPerGeneration;
      break;

    case Sensor.RANDOM:
      sensorVal = randomFloat();
      break;

    default:
      break;
  }

  if (isNaN(sensorVal) || sensorVal < 0.0) sensorVal = 0.0;
  else if (sensorVal > 1.0) sensorVal = 1.0;

  return sensorVal;
}

export const SENSOR_NAMES: ReadonlyArray<string> = [
  'WIND_REL_X', 'WIND_REL_Y', 'TARGET_REL_X', 'TARGET_REL_Y',
  'TARGET_DIST', 'BOUNDARY_DIST', 'SPEED', 'OSC1', 'AGE', 'RANDOM',
  'OBSTACLE_FWD',
];
