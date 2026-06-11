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
  finishGate,
  isOnFinishGate,
  startBox,
  startSlot,
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

describe('finish gate', () => {
  it('places a 16-cell gate centered on the quadrant center (128 grid)', () => {
    const g = finishGate(3, 128, 128); // NE-Zentrum (96, 96)
    expect(g.y).toBe(96);
    expect(g.x0).toBe(88);
    expect(g.x1).toBe(103);
    expect(g.x1 - g.x0 + 1).toBe(16);
  });
  it('detects boats on the gate but not at the buoys or beside the line', () => {
    const g = finishGate(3, 128, 128);
    expect(isOnFinishGate(88, 96, g)).toBe(true);
    expect(isOnFinishGate(103, 96, g)).toBe(true);
    expect(isOnFinishGate(87, 96, g)).toBe(false);  // Boje
    expect(isOnFinishGate(104, 96, g)).toBe(false); // Boje
    expect(isOnFinishGate(96, 95, g)).toBe(false);  // eine Reihe daneben
  });
});

describe('start box', () => {
  it('lines up in the opposite quadrant facing the gate', () => {
    const box = startBox(3, 128, 128); // Ziel NE → Start SW
    expect(box.centerX).toBe(32);
    expect(box.dir).toBe(1);           // Gate liegt nördlich
    expect(box.startLineY).toBe(35);
    expect(box.width).toBe(42);
  });
  it('fills rows behind the start line', () => {
    const box = startBox(3, 128, 128);
    const first = startSlot(0, box, 128, 128);
    expect(first.y).toBe(34); // direkt hinter der Linie bei y=35
    expect(first.x).toBe(11);
    const secondRow = startSlot(box.width, box, 128, 128);
    expect(secondRow.y).toBe(33); // eine Reihe weiter hinten
    expect(secondRow.x).toBe(11);
  });
  it('points away from the gate when the target is in the south', () => {
    const box = startBox(0, 128, 128); // Ziel SW → Start NE
    expect(box.dir).toBe(-1);
    const first = startSlot(0, box, 128, 128);
    expect(first.y).toBe(box.startLineY + 1);
  });
});

describe('regatta challengeBits layout', () => {
  it('stores the arrival tick below the finished bit', () => {
    const bits = REGATTA_FINISHED_BIT | 1234;
    expect(bits & REGATTA_TICK_MASK).toBe(1234);
    expect((bits & REGATTA_FINISHED_BIT) !== 0).toBe(true);
  });
});
