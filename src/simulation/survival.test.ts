import { describe, expect, it } from 'vitest';
import { passedSurvivalCriterion, type SurvivalParams } from './survival';
import { createDefaultIndiv, Challenge, Compass, Coord, type Indiv } from './types';
import { sailingEnv } from './sailing';
import type { Grid } from './grid';

const PARAMS: SurvivalParams = {
  sizeX: 160,
  sizeY: 160,
  challenge: Challenge.CHALLENGE_REGATTA,
  stepsPerGeneration: 600,
  courseLegs: 1,
};

const grid = {} as Grid; // von passedSurvivalCriterion nicht genutzt

function nonFinisher(x: number, y: number, vmgAccum: number, vmgTicks: number): Indiv {
  const ind = createDefaultIndiv();
  ind.alive = true;
  ind.loc = new Coord(x, y);
  ind.challengeBits = 0; // nicht gefinisht
  ind.vmgAccum = vmgAccum;
  ind.vmgTicks = vmgTicks;
  return ind;
}

describe('VMG-Shaping in der Fitness', () => {
  it('belohnt höhere VMG bei gleicher Endposition', () => {
    sailingEnv.targetQuadrant = 3; // NE
    sailingEnv.windFrom = Compass.NE;

    // Zwei Boote an identischer Position (gleicher Distanz-Fortschritt),
    // aber unterschiedlich effizient gesegelt.
    const efficient = nonFinisher(40, 40, 0.35 * 300, 300); // Ø-VMG 0.35 (sauberer Kreuzschlag)
    const pincher = nonFinisher(40, 40, 0.05 * 300, 300); // Ø-VMG 0.05 (im Wind gepinscht)

    const sEff = passedSurvivalCriterion(efficient, Challenge.CHALLENGE_REGATTA, PARAMS, grid);
    const sPin = passedSurvivalCriterion(pincher, Challenge.CHALLENGE_REGATTA, PARAMS, grid);

    expect(sEff.score).toBeGreaterThan(sPin.score);
  });

  it('hält Nicht-Finisher unter dem Finisher-Floor (0.25)', () => {
    sailingEnv.targetQuadrant = 3;
    sailingEnv.windFrom = Compass.NE;

    // Bestmöglicher Nicht-Finisher: nah am Ziel UND maximale VMG.
    const best = nonFinisher(118, 118, 1.0 * 300, 300); // Ziel-Quadrant-Zentrum ~ (120,120)
    const s = passedSurvivalCriterion(best, Challenge.CHALLENGE_REGATTA, PARAMS, grid);

    expect(s.score).toBeLessThan(0.25);
  });

  it('negative VMG (Wegsegeln) zählt nicht negativ', () => {
    sailingEnv.targetQuadrant = 3;
    sailingEnv.windFrom = Compass.NE;

    const awaySailor = nonFinisher(40, 40, -0.5 * 300, 300);
    const idleSailor = nonFinisher(40, 40, 0, 300);

    const sAway = passedSurvivalCriterion(awaySailor, Challenge.CHALLENGE_REGATTA, PARAMS, grid);
    const sIdle = passedSurvivalCriterion(idleSailor, Challenge.CHALLENGE_REGATTA, PARAMS, grid);

    // Beide bekommen vmgNorm = 0 -> identischer Score (kein negativer Beitrag).
    expect(sAway.score).toBeCloseTo(sIdle.score, 6);
  });
});
