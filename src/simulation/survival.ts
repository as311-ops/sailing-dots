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
  currentObjective,
  marksRounded,
  REGATTA_FINISHED_BIT,
  REGATTA_TICK_MASK,
  REGATTA_PENALTY_BIT,
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
  courseLegs: number;
}

// Mindest-Score fürs Ankommen — liegt über dem Maximum des Trostpreises (0.2)
const FINISHER_SCORE_FLOOR = 0.25;
const CONSOLATION_FACTOR = 0.2;
// Gewicht des VMG-Effizienz-Signals im Trostpreis (Rest = reiner Distanz-Fortschritt)
const VMG_BLEND = 0.4;
// Frühstart: Score wird gestutzt, aber Ankommen schlägt weiterhin den Trostpreis
const PENALTY_FACTOR = 0.6;
const PENALIZED_FINISHER_FLOOR = 0.21;

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

  const penalized = (indiv.challengeBits & REGATTA_PENALTY_BIT) !== 0;

  if (indiv.challengeBits & REGATTA_FINISHED_BIT) {
    const arrivalTick = indiv.challengeBits & REGATTA_TICK_MASK;
    const base = Math.max(
      FINISHER_SCORE_FLOOR,
      1.0 - arrivalTick / params.stepsPerGeneration,
    );
    const score = penalized
      ? Math.max(PENALIZED_FINISHER_FLOOR, base * PENALTY_FACTOR)
      : base;
    return { passed: true, score };
  }

  // Trostpreis: Kursfortschritt = gerundete Marken + Nähe zum aktuellen Ziel
  const legs = Math.max(1, params.courseLegs);
  const objective = currentObjective(
    indiv.challengeBits, sailingEnv.targetQuadrant, legs, params.sizeX, params.sizeY,
  );
  const dx = objective.x - indiv.loc.x;
  const dy = objective.y - indiv.loc.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxDist = Math.sqrt(params.sizeX * params.sizeX + params.sizeY * params.sizeY);
  const progress = (marksRounded(indiv.challengeBits) + (1.0 - dist / maxDist)) / legs;

  // VMG-Shaping: mittlere velocity-made-good zum Ziel (0..~1) ergänzt den reinen
  // Distanz-Gradienten um ein Effizienz-Signal. Ein Boot, das sauber bei 45°
  // segelt, wird gegenüber einem, das im Wind pinscht/stallt, bevorzugt — selbst
  // bei gleicher Endposition. Negative VMG (Wegsegeln) zählt als 0.
  const vmgPerTick = indiv.vmgTicks > 0 ? indiv.vmgAccum / indiv.vmgTicks : 0;
  const vmgNorm = Math.max(0, Math.min(1, vmgPerTick));
  const blended = (1 - VMG_BLEND) * progress + VMG_BLEND * vmgNorm;

  const score = CONSOLATION_FACTOR * blended * (penalized ? PENALTY_FACTOR : 1);
  return { passed: score > 0, score };
}
