import { describe, expect, it } from 'vitest';
import { randomBitFlip, generateChildGenome } from './genome';
import type { Gene, Genome } from './types';

function gene(weight: number): Gene {
  return { sourceType: 1, sourceNum: 3, sinkType: 1, sinkNum: 1, weight } as Gene;
}

describe('Gauß-Gewichts-Mutation', () => {
  it('hält das Gewicht im int16-Bereich (Sättigung statt Wrap)', () => {
    const g: Genome = [gene(32000)];
    for (let i = 0; i < 3000; i++) randomBitFlip(g);
    expect(g[0].weight).toBeGreaterThanOrEqual(-32768);
    expect(g[0].weight).toBeLessThanOrEqual(32767);
  });

  it('macht im Mittel kleine Schritte (keine Sign-Flip-Sprünge)', () => {
    // Gewicht 0, viele Mutationen: bei Bit-Flip-Mutation läge der Betrag oft
    // bei tausenden; bei Gauß-Perturbation (std ~1229) bleibt er moderat.
    let maxAbs = 0;
    for (let trial = 0; trial < 50; trial++) {
      const g: Genome = [gene(0)];
      // genug Versuche, dass der Gewichts-Zweig (20%) sicher trifft
      for (let i = 0; i < 5; i++) randomBitFlip(g);
      maxAbs = Math.max(maxAbs, Math.abs(g[0].weight));
    }
    // Ein einzelner Bit-Flip von Bit 14/15 würde 16384+ erzeugen; Gauß bleibt klar darunter.
    expect(maxAbs).toBeLessThan(10000);
  });
});

describe('Struktur-bewusstes Crossover', () => {
  it('mittelt Gewichte bei gleicher Verbindung und erhält die Struktur', () => {
    const len = 8;
    const p0: Genome = Array.from({ length: len }, () => gene(1000));
    const p1: Genome = Array.from({ length: len }, () => gene(3000));
    const child = generateChildGenome([p0, p1], {
      sexualReproduction: true,
      chooseParentsByFitness: true, // -> parent1=idx1, parent2=idx0 (deterministisch)
      pointMutationRate: 0,
      geneInsertionDeletionRate: 0,
      deletionRatio: 0.5,
      genomeMaxLength: 300,
      maxNumberNeurons: 5,
    });
    expect(child.length).toBe(len);
    for (const c of child) {
      expect(c.weight).toBe(2000); // (1000 + 3000) / 2
      expect(c.sourceNum).toBe(3); // Struktur unverändert
      expect(c.sinkNum).toBe(1);
    }
  });
});
