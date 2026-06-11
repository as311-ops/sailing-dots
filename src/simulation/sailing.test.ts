import { describe, expect, it } from 'vitest';
import { Compass } from './types';
import {
  POLAR_TABLE,
  octantOf,
  compassFromOctant,
  relativeOctantSteps,
  polarSpeed,
  quadrantCenter,
  isInQuadrant,
  advanceSailingGeneration,
  sailingEnv,
  REGATTA_FINISHED_BIT,
  REGATTA_TICK_MASK,
} from './sailing';

describe('octant mapping', () => {
  it('maps all 8 compass directions to octants and back', () => {
    const dirs = [
      Compass.E, Compass.NE, Compass.N, Compass.NW,
      Compass.W, Compass.SW, Compass.S, Compass.SE,
    ];
    for (let oct = 0; oct < 8; oct++) {
      expect(octantOf(dirs[oct])).toBe(oct);
      expect(compassFromOctant(oct)).toBe(dirs[oct]);
    }
  });
});

describe('relativeOctantSteps', () => {
  it('is 0 for identical directions', () => {
    expect(relativeOctantSteps(Compass.N, Compass.N)).toBe(0);
  });
  it('is 4 for opposite directions', () => {
    expect(relativeOctantSteps(Compass.N, Compass.S)).toBe(4);
    expect(relativeOctantSteps(Compass.E, Compass.W)).toBe(4);
  });
  it('is symmetric', () => {
    expect(relativeOctantSteps(Compass.N, Compass.E)).toBe(2);
    expect(relativeOctantSteps(Compass.E, Compass.N)).toBe(2);
  });
  it('handles wraparound across the octant seam', () => {
    expect(relativeOctantSteps(Compass.SE, Compass.E)).toBe(1);
    expect(relativeOctantSteps(Compass.SE, Compass.NE)).toBe(2);
  });
});

describe('polarSpeed', () => {
  it('is nearly zero directly upwind (no-go zone)', () => {
    expect(polarSpeed(Compass.N, Compass.N)).toBe(POLAR_TABLE[0]);
    expect(POLAR_TABLE[0]).toBeLessThan(0.1);
  });
  it('is fastest on a beam reach (90°)', () => {
    expect(polarSpeed(Compass.E, Compass.N)).toBe(1.0);
    expect(polarSpeed(Compass.W, Compass.N)).toBe(1.0);
  });
  it('is slow close-hauled (45°)', () => {
    expect(polarSpeed(Compass.NE, Compass.N)).toBe(POLAR_TABLE[1]);
  });
  it('is fast on a broad reach (135°)', () => {
    expect(polarSpeed(Compass.SE, Compass.N)).toBe(POLAR_TABLE[3]);
  });
  it('is moderate running dead downwind (180°)', () => {
    expect(polarSpeed(Compass.S, Compass.N)).toBe(POLAR_TABLE[4]);
  });
});

describe('quadrants', () => {
  it('computes quadrant centers for a 128x128 grid', () => {
    expect(quadrantCenter(0, 128, 128)).toEqual({ x: 32, y: 32 });
    expect(quadrantCenter(1, 128, 128)).toEqual({ x: 96, y: 32 });
    expect(quadrantCenter(2, 128, 128)).toEqual({ x: 32, y: 96 });
    expect(quadrantCenter(3, 128, 128)).toEqual({ x: 96, y: 96 });
  });
  it('classifies locations into quadrants', () => {
    expect(isInQuadrant(0, 0, 0, 128, 128)).toBe(true);
    expect(isInQuadrant(64, 64, 3, 128, 128)).toBe(true);
    expect(isInQuadrant(63, 64, 2, 128, 128)).toBe(true);
    expect(isInQuadrant(64, 63, 1, 128, 128)).toBe(true);
    expect(isInQuadrant(64, 64, 0, 128, 128)).toBe(false);
  });
});

describe('advanceSailingGeneration', () => {
  it('keeps wind fixed in fixed mode', () => {
    advanceSailingGeneration(
      { windMode: 'fixed', windDirection: Compass.N, windRotatePeriod: 30, targetQuadrant: 2 },
      99,
    );
    expect(sailingEnv.windFrom).toBe(Compass.N);
    expect(sailingEnv.targetQuadrant).toBe(2);
  });
  it('rotates wind by 45° every windRotatePeriod generations', () => {
    const params = { windMode: 'rotate' as const, windDirection: Compass.N, windRotatePeriod: 30, targetQuadrant: 0 };
    advanceSailingGeneration(params, 0);
    expect(sailingEnv.windFrom).toBe(Compass.N);
    advanceSailingGeneration(params, 29);
    expect(sailingEnv.windFrom).toBe(Compass.N);
    advanceSailingGeneration(params, 30);
    expect(sailingEnv.windFrom).toBe(Compass.NW);
    advanceSailingGeneration(params, 60);
    expect(sailingEnv.windFrom).toBe(Compass.W);
  });
  it('picks a random quadrant when targetQuadrant is -1', () => {
    advanceSailingGeneration(
      { windMode: 'fixed', windDirection: Compass.E, windRotatePeriod: 30, targetQuadrant: -1 },
      0,
    );
    expect(sailingEnv.targetQuadrant).toBeGreaterThanOrEqual(0);
    expect(sailingEnv.targetQuadrant).toBeLessThanOrEqual(3);
  });
});

describe('regatta challengeBits layout', () => {
  it('stores the arrival tick below the finished bit', () => {
    const bits = REGATTA_FINISHED_BIT | 1234;
    expect(bits & REGATTA_TICK_MASK).toBe(1234);
    expect((bits & REGATTA_FINISHED_BIT) !== 0).toBe(true);
  });
});
