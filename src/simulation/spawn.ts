// spawn.ts -- Generation management: initialization and reproduction
// Ported from biosim4: spawnNewGeneration.cpp

import { Coord, Genome, Sensor, Action, Challenge } from './types';
import { Grid } from './grid';
import { Peeps } from './peeps';
import { Signals } from './signals';
import { SimParams } from './params';
import { makeRandomGenome, generateChildGenome, genomeSimilarity } from './genome';
import { createWiringFromGenome } from './neural-net';
import { passedSurvivalCriterion } from './survival';
import { computeGenomeProfile, type GenomeProfile } from './genome-profile';
import { createChampionSnapshot, type ChampionSnapshot } from './lineage';
import {
  sailingEnv,
  advanceSailingGeneration,
  startBox,
  startSlot,
  REGATTA_FINISHED_BIT,
  REGATTA_TICK_MASK,
} from './sailing';

export interface GenerationResult {
  survivors: number;        // Finisher: Boote, die den Ziel-Quadranten erreicht haben
  generation: number;
  diversity: number;
  avgFitness: number;       // 0..1 average score of parent candidates
  finisherRate: number;     // Finisher / Population
  avgArrivalTick: number;   // Ø Ankunfts-Tick der Finisher, -1 wenn keine
  genomeProfile: GenomeProfile | null;
  championSnapshot: ChampionSnapshot | null;
}

/**
 * Startaufstellung: Die Boote füllen Reihe für Reihe die Startbox im
 * gegenüberliegenden Quadranten — alle hinter der Startlinie, mit (nahezu)
 * gleicher Distanz zum Ziel-Gate. Übergelaufene Slots (geclampte Ränder)
 * werden übersprungen; als letzter Ausweg gilt eine zufällige freie Zelle.
 */
function createStartLineupFinder(params: SimParams): (grid: Grid) => Coord {
  const box = startBox(sailingEnv.targetQuadrant, params.sizeX, params.sizeY);
  let slot = 0;
  const maxSlots = params.population * 3;
  return (grid: Grid) => {
    while (slot < maxSlots) {
      const s = startSlot(slot++, box, params.sizeX, params.sizeY);
      const loc = new Coord(s.x, s.y);
      if (grid.isEmptyAt(loc)) return loc;
    }
    return grid.findEmptyLocation();
  };
}

/**
 * Initialize generation 0: create random genomes and wire neural nets.
 * If seedGenome is provided, all individuals start with mutated copies of it.
 */
export function initializeGeneration0(
  peeps: Peeps,
  grid: Grid,
  signals: Signals,
  params: SimParams,
  seedGenome?: Genome,
): void {
  grid.zeroFill();
  signals.zeroFill();
  grid.createBarrier(params.barrierType, params);
  peeps.init(params.population, grid, createStartLineupFinder(params));

  const wiringParams = {
    maxNumberNeurons: params.maxNumberNeurons,
    numSenses: Sensor.NUM_SENSES,
    numActions: Action.NUM_ACTIONS,
  };

  if (seedGenome) {
    // Seed mode: generate children from the seed genome with light mutation
    const reproParams = {
      sexualReproduction: false,
      chooseParentsByFitness: false,
      pointMutationRate: params.pointMutationRate,
      geneInsertionDeletionRate: params.geneInsertionDeletionRate,
      deletionRatio: params.deletionRatio,
      genomeMaxLength: params.genomeMaxLength,
      maxNumberNeurons: params.maxNumberNeurons,
    };
    for (let i = 1; i <= params.population; i++) {
      const indiv = peeps.getIndiv(i);
      indiv.genome = generateChildGenome([seedGenome], reproParams);
      indiv.nnet = createWiringFromGenome(indiv.genome, wiringParams);
    }
  } else {
    for (let i = 1; i <= params.population; i++) {
      const indiv = peeps.getIndiv(i);
      indiv.genome = makeRandomGenome(
        params.genomeInitialLengthMin,
        params.genomeInitialLengthMax,
      );
      indiv.nnet = createWiringFromGenome(indiv.genome, wiringParams);
    }
  }
}

/**
 * Spawn a new generation from the survivors of the current one.
 * Returns statistics about the generation.
 */
export function spawnNewGeneration(
  peeps: Peeps,
  grid: Grid,
  signals: Signals,
  params: SimParams,
  generation: number,
): GenerationResult {
  // Evaluate survival for all individuals
  const parentGenomes: Genome[] = [];

  // Collect parent candidates (alle mit Score-Gradient), Finisher separat zählen
  const candidates: { genome: Genome; score: number }[] = [];
  let finisherCount = 0;
  let arrivalTickSum = 0;

  for (let i = 1; i <= peeps.population; i++) {
    const indiv = peeps.getIndiv(i);
    if (!indiv.alive) continue;

    const result = passedSurvivalCriterion(indiv, params.challenge as Challenge, params, grid);
    if (result.passed) {
      candidates.push({ genome: indiv.genome, score: result.score });
    }
    if (indiv.challengeBits & REGATTA_FINISHED_BIT) {
      finisherCount++;
      arrivalTickSum += indiv.challengeBits & REGATTA_TICK_MASK;
    }
  }

  const survivorCount = finisherCount;
  const finisherRate = params.population > 0 ? finisherCount / params.population : 0;
  const avgArrivalTick = finisherCount > 0 ? arrivalTickSum / finisherCount : -1;

  // Wind & Ziel-Quadrant für die NÄCHSTE Generation festlegen — muss vor der
  // Platzierung der neuen Boote geschehen (Spawn hängt vom Ziel ab)
  advanceSailingGeneration(params, generation + 1);

  // Sort by fitness (highest score first) for fitness-proportional selection
  if (params.chooseParentsByFitness) {
    candidates.sort((a, b) => b.score - a.score);
  }

  // Create champion snapshot from best survivor
  const bestCandidate = candidates[0];
  const championSnapshot = bestCandidate
    ? createChampionSnapshot(bestCandidate.genome, bestCandidate.score, generation, params.maxNumberNeurons)
    : null;

  for (const c of candidates) {
    parentGenomes.push(c.genome);
  }

  // Calculate genetic diversity (sample-based)
  let diversity = 0;
  if (parentGenomes.length >= 2) {
    const sampleSize = Math.min(20, parentGenomes.length);
    let totalSim = 0;
    let comparisons = 0;
    for (let i = 0; i < sampleSize - 1; i++) {
      for (let j = i + 1; j < sampleSize; j++) {
        totalSim += genomeSimilarity(parentGenomes[i], parentGenomes[j]);
        comparisons++;
      }
    }
    diversity = comparisons > 0 ? 1.0 - (totalSim / comparisons) : 0;
  }

  // Average fitness score
  const avgFitness = candidates.length > 0
    ? candidates.reduce((sum, c) => sum + c.score, 0) / candidates.length
    : 0;

  // If no survivors, create random genomes
  if (parentGenomes.length === 0) {
    initializeGeneration0(peeps, grid, signals, params);
    return { survivors: 0, generation, diversity: 1.0, avgFitness: 0, finisherRate: 0, avgArrivalTick: -1, genomeProfile: null, championSnapshot: null };
  }

  // Compute consensus genome profile from survivors
  const wiringParams = {
    maxNumberNeurons: params.maxNumberNeurons,
    numSenses: Sensor.NUM_SENSES,
    numActions: Action.NUM_ACTIONS,
  };
  const genomeProfile = computeGenomeProfile(parentGenomes, wiringParams, 12);

  // Generate new population from survivors
  initializeNewGeneration(parentGenomes, peeps, grid, signals, params);

  return { survivors: survivorCount, generation, diversity, avgFitness, finisherRate, avgArrivalTick, genomeProfile, championSnapshot };
}

/**
 * Initialize a new generation from parent genomes.
 */
function initializeNewGeneration(
  parentGenomes: Genome[],
  peeps: Peeps,
  grid: Grid,
  signals: Signals,
  params: SimParams,
): void {
  grid.zeroFill();
  signals.zeroFill();
  grid.createBarrier(params.barrierType, params);
  peeps.init(params.population, grid, createStartLineupFinder(params));

  const wiringParams = {
    maxNumberNeurons: params.maxNumberNeurons,
    numSenses: Sensor.NUM_SENSES,
    numActions: Action.NUM_ACTIONS,
  };

  const reproParams = {
    sexualReproduction: params.sexualReproduction,
    chooseParentsByFitness: params.chooseParentsByFitness,
    pointMutationRate: params.pointMutationRate,
    geneInsertionDeletionRate: params.geneInsertionDeletionRate,
    deletionRatio: params.deletionRatio,
    genomeMaxLength: params.genomeMaxLength,
    maxNumberNeurons: params.maxNumberNeurons,
  };

  for (let i = 1; i <= params.population; i++) {
    const indiv = peeps.getIndiv(i);
    indiv.genome = generateChildGenome(parentGenomes, reproParams);
    indiv.nnet = createWiringFromGenome(indiv.genome, wiringParams);
  }
}
