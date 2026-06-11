// actions.ts -- Segel-Aktionen: Drehen (TURN_LEFT/TURN_RIGHT) + Auto-Vortrieb
// Das Boot segelt jeden Tick automatisch in Heading-Richtung; die
// Move-Wahrscheinlichkeit kommt aus der Polartabelle (sailing.ts).

import { Indiv, Action, Coord } from './types';
import { Grid } from './grid';
import { Peeps } from './peeps';
import { Signals } from './signals';
import { SimParams } from './params';
import { randomFloat } from './random';
import { polarSpeed, sailingEnv } from './sailing';

// Glättungsfaktor für den SPEED-Sensor (EMA über ~16 Ticks)
const SPEED_EMA_ALPHA = 1 / 16;

// ---------------------------------------------------------------------------
// prob2bool -- convert probability to boolean
// ---------------------------------------------------------------------------

export function prob2bool(factor: number): boolean {
  return randomFloat() < factor;
}

// ---------------------------------------------------------------------------
// responseCurve -- sigmoid-like response curve
// ---------------------------------------------------------------------------

export function responseCurve(r: number, kFactor: number): number {
  const k = kFactor;
  return Math.pow(r - 2.0, -2.0 * k) - Math.pow(2.0, -2.0 * k) * (1.0 - r);
}

// ---------------------------------------------------------------------------
// executeActions -- main entry point
// ---------------------------------------------------------------------------

export function executeActions(
  indiv: Indiv,
  actionLevels: ArrayLike<number>,
  grid: Grid,
  peeps: Peeps,
  _signals: Signals,
  params: SimParams,
): void {
  const responsivenessAdjusted = responseCurve(
    indiv.responsiveness,
    params.responsivenessCurveKFactor,
  );

  // --- Ruder: Differenz der beiden Turn-Outputs entscheidet die Drehung ---
  // rotate(1) = 45° im Uhrzeigersinn, rotate(7) = 45° gegen den Uhrzeigersinn
  let turn = actionLevels[Action.TURN_RIGHT] - actionLevels[Action.TURN_LEFT];
  turn = Math.tanh(turn) * responsivenessAdjusted;
  if (prob2bool(Math.abs(turn))) {
    indiv.heading = indiv.heading.rotate(turn > 0 ? 1 : 7);
  }

  // --- Auto-Vortrieb entlang des Headings, Tempo aus der Polartabelle ---
  const speed = polarSpeed(indiv.heading.dir9, sailingEnv.windFrom);
  let moved = 0;
  if (prob2bool(speed)) {
    const nc = indiv.heading.asNormalizedCoord();
    const newLoc = new Coord(indiv.loc.x + nc.x, indiv.loc.y + nc.y);
    if (grid.isInBounds(newLoc) && grid.isEmptyAt(newLoc)) {
      peeps.queueForMove(indiv.index, newLoc);
      moved = 1;
    }
  }

  indiv.speedEMA += (moved - indiv.speedEMA) * SPEED_EMA_ALPHA;
}
