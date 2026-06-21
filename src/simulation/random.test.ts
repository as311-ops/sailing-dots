import { describe, expect, it, afterEach } from 'vitest';
import { seedRng, clearRng, isSeeded, randomFloat, randomUint } from './random';
import { Simulator } from './simulator';
import { Compass } from './types';

afterEach(() => clearRng()); // globalen PRNG-Zustand nicht in andere Tests lecken lassen

describe('seedbarer RNG', () => {
  it('gleicher Seed -> identische Folge', () => {
    seedRng(42);
    const a = [randomFloat(), randomFloat(), randomUint(0, 1_000_000)];
    seedRng(42);
    const b = [randomFloat(), randomFloat(), randomUint(0, 1_000_000)];
    expect(a).toEqual(b);
  });

  it('verschiedene Seeds -> verschiedene Folge', () => {
    seedRng(1);
    const a = randomFloat();
    seedRng(2);
    const b = randomFloat();
    expect(a).not.toBe(b);
  });

  it('clearRng schaltet zurück auf Math.random', () => {
    seedRng(1);
    expect(isSeeded()).toBe(true);
    clearRng();
    expect(isSeeded()).toBe(false);
    const v = randomFloat();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});

describe('deterministischer Simulator', () => {
  function run(): number[] {
    const sim = new Simulator({
      sizeX: 64,
      sizeY: 64,
      population: 80,
      stepsPerGeneration: 150,
      windMode: 'fixed',
      windDirection: Compass.N,
      targetQuadrant: 1,
      deterministic: true,
      RNGSeed: 777,
    });
    sim.init();
    const out: number[] = [];
    for (let g = 0; g < 6; g++) out.push(sim.runGeneration().finisherRate);
    return out;
  }

  it('deterministic + fester Seed -> Byte-gleicher Lauf', () => {
    expect(run()).toEqual(run());
  });

  it('anderer Seed -> i. d. R. anderer Verlauf', () => {
    const base = run();
    const sim = new Simulator({
      sizeX: 64, sizeY: 64, population: 80, stepsPerGeneration: 150,
      windMode: 'fixed', windDirection: Compass.N, targetQuadrant: 1,
      deterministic: true, RNGSeed: 778,
    });
    sim.init();
    const other: number[] = [];
    for (let g = 0; g < 6; g++) other.push(sim.runGeneration().finisherRate);
    expect(other).not.toEqual(base);
  });
});
