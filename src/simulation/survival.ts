// survival.ts -- Fitness-Bewertung für CHALLENGE_REGATTA
//
// Angekommene Boote: score = 1 - ankunftsTick/stepsPerGeneration (früher = besser),
// mit Untergrenze 0.25, damit Ankommen immer den Trostpreis schlägt.
// Nicht angekommene Boote: Trostpreis-Gradient 0.2 * (1 - dist/maxDist), damit
// frühe Generationen überhaupt einen Selektionsdruck Richtung Ziel haben.

import { type Indiv, Challenge } from './types';
import type { Grid } from './grid';
import {
  sailingEnv,
  quadrantCenter,
  REGATTA_FINISHED_BIT,
  REGATTA_TICK_MASK,
} from './sailing';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface SurvivalResult {
  passed: boolean;
  score: number; // 0.0..1.0
}

// ---------------------------------------------------------------------------
// Params subset needed by survival criteria
// ---------------------------------------------------------------------------

export interface SurvivalParams {
  sizeX: number;
  sizeY: number;
  challenge: Challenge;
  stepsPerGeneration: number;
}

// Mindest-Score fürs Ankommen — liegt über dem Maximum des Trostpreises (0.2)
const FINISHER_SCORE_FLOOR = 0.25;
const CONSOLATION_FACTOR = 0.2;

// ---------------------------------------------------------------------------
// passedSurvivalCriterion
// ---------------------------------------------------------------------------

export function passedSurvivalCriterion(
  indiv: Indiv,
  _challenge: Challenge,
  params: SurvivalParams,
  _grid: Grid,
): SurvivalResult {
  if (!indiv.alive) {
    return { passed: false, score: 0.0 };
  }

  if (indiv.challengeBits & REGATTA_FINISHED_BIT) {
    const arrivalTick = indiv.challengeBits & REGATTA_TICK_MASK;
    const score = Math.max(
      FINISHER_SCORE_FLOOR,
      1.0 - arrivalTick / params.stepsPerGeneration,
    );
    return { passed: true, score };
  }

  const center = quadrantCenter(sailingEnv.targetQuadrant, params.sizeX, params.sizeY);
  const dx = center.x - indiv.loc.x;
  const dy = center.y - indiv.loc.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxDist = Math.sqrt(params.sizeX * params.sizeX + params.sizeY * params.sizeY);
  const score = CONSOLATION_FACTOR * (1.0 - dist / maxDist);
  return { passed: score > 0, score };
}
