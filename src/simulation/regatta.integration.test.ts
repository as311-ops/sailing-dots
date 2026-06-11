import { describe, expect, it } from 'vitest';
import { Simulator } from './simulator';
import { Compass } from './types';

describe('Regatta end-to-end', () => {
  it('boats evolve toward the target over generations (downwind)', () => {
    const sim = new Simulator({
      sizeX: 64,
      sizeY: 64,
      population: 200,
      stepsPerGeneration: 250,
      windMode: 'fixed',
      windDirection: Compass.N,
      targetQuadrant: 1, // SE — in Lee, gut erreichbar
      genomeInitialLengthMin: 16,
      genomeInitialLengthMax: 16,
    });
    sim.init();

    const finisherRates: number[] = [];
    for (let gen = 0; gen < 30; gen++) {
      const result = sim.runGeneration();
      finisherRates.push(result.finisherRate);
    }

    const early = finisherRates.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const late = finisherRates.slice(-5).reduce((a, b) => a + b, 0) / 5;

    // Spätere Generationen müssen deutlich besser segeln als Generation 0-4.
    // Das Gate ist ein Nadelöhr (8 Zellen auf dem 64er-Grid) — die Quote liegt
    // daher deutlich niedriger als beim früheren Quadranten-Ziel.
    expect(late).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(0.15);
  });

  it('runs a full-feature course (islands, triangle, pre-start) without errors', () => {
    const sim = new Simulator({
      sizeX: 64,
      sizeY: 64,
      population: 150,
      stepsPerGeneration: 300,
      windMode: 'random',
      targetQuadrant: -1,
      islands: 4,
      courseLegs: 3,
      preStartTicks: 30,
    });
    sim.init();

    for (let gen = 0; gen < 8; gen++) {
      const result = sim.runGeneration();
      expect(result.finisherRate).toBeGreaterThanOrEqual(0);
    }

    const state = sim.getState();
    expect(state.population).toBeGreaterThan(0);
    expect(state.courseLegs).toBe(3);
    expect(state.preStartTicks).toBe(30);
    // Inseln vorhanden (Barrier-Zellen werden ans Rendering gemeldet)
    expect(state.barrierLocations.length).toBeGreaterThan(0);
  });

  it('produces a valid state snapshot with headings and wind', () => {
    const sim = new Simulator({
      sizeX: 32,
      sizeY: 32,
      population: 50,
      stepsPerGeneration: 50,
      windMode: 'fixed',
      windDirection: Compass.W,
      targetQuadrant: 3,
    });
    sim.init();
    sim.step();

    const state = sim.getState();
    expect(state.agentHeadings.length).toBe(state.population);
    expect(state.windFrom).toBe(Compass.W);
    expect(state.targetQuadrant).toBe(3);
    // Headings sind echte Richtungen, nie CENTER (4)
    for (const h of state.agentHeadings) {
      expect(h).not.toBe(4);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(8);
    }
  });
});
