// params.ts -- Simulation parameters
// Ported from biosim4: params.h, params.cpp

import { Challenge, Compass } from './types';

export interface SimParams {
  // Grid dimensions
  sizeX: number;
  sizeY: number;

  // Population
  population: number;
  stepsPerGeneration: number;
  maxGenerations: number;

  // Genome
  genomeInitialLengthMin: number;
  genomeInitialLengthMax: number;
  genomeMaxLength: number;
  maxNumberNeurons: number;

  // Mutation
  pointMutationRate: number;
  geneInsertionDeletionRate: number;
  deletionRatio: number;

  // Reproduction
  sexualReproduction: boolean;
  chooseParentsByFitness: boolean;

  // Wind / Regatta
  windMode: 'fixed' | 'rotate' | 'random';
  windDirection: Compass;     // Startrichtung, aus der der Wind weht
  windRotatePeriod: number;   // Generationen bis zur nächsten 45°-Drehung (windMode 'rotate')
  targetQuadrant: number;     // 0..3 fest, -1 = zufällig pro Generation
  islands: number;            // Anzahl Inseln (0 = offenes Meer), pro Generation neu gewürfelt
  courseLegs: number;         // 1 = direkt, 2 = eine Marke, 3 = Dreieckskurs mit zwei Marken
  preStartTicks: number;      // Vorstart-Phase in Ticks (0 = aus); Frühstarter werden bestraft

  // Behavior
  populationSensorRadius: number;
  signalSensorRadius: number;
  responsiveness: number;
  responsivenessCurveKFactor: number;
  longProbeDistance: number;
  shortProbeBarrierDistance: number;
  valenceSaturationMag: number;

  // Signals
  signalLayers: number;

  // Challenge / Barriers
  challenge: number;
  barrierType: number;

  // Determinism
  deterministic: boolean;
  RNGSeed: number;

  // Video / Display (kept for compatibility, may not be used in TS)
  saveVideo: boolean;
  videoStride: number;
  videoSaveFirstFrames: number;
  displayScale: number;
  agentSize: number;

  // Analysis
  genomeAnalysisStride: number;
  displaySampleGenomes: number;
  genomeComparisonMethod: number;

  // Graph logging
  updateGraphLog: boolean;
  updateGraphLogStride: number;

  // Threads (kept for API compat, single-threaded in browser)
  numThreads: number;

  // Paths (kept for API compat)
  logDir: string;
  imageDir: string;
  graphLogUpdateCommand: string;

  // Auto-updated
  parameterChangeGenerationNumber: number;
}

/**
 * Default parameters matching biosim4's ParamManager::setDefaults().
 */
export const DEFAULT_PARAMS: SimParams = {
  sizeX: 160,
  sizeY: 160,
  population: 300,
  stepsPerGeneration: 450,
  maxGenerations: 200000,

  genomeInitialLengthMin: 24,
  genomeInitialLengthMax: 24,
  genomeMaxLength: 300,
  maxNumberNeurons: 5,

  pointMutationRate: 0.001,
  geneInsertionDeletionRate: 0.0,
  deletionRatio: 0.5,

  sexualReproduction: true,
  chooseParentsByFitness: true,

  windMode: 'rotate',
  windDirection: Compass.N,
  windRotatePeriod: 30,
  targetQuadrant: -1,
  islands: 0,
  courseLegs: 1,
  preStartTicks: 0,

  populationSensorRadius: 2.5,
  signalSensorRadius: 2.0,
  responsiveness: 0.5,
  responsivenessCurveKFactor: 2,
  longProbeDistance: 16,
  shortProbeBarrierDistance: 4,
  valenceSaturationMag: 0.5,

  signalLayers: 1,

  challenge: Challenge.CHALLENGE_REGATTA,
  barrierType: 0,

  deterministic: false,
  RNGSeed: 12345678,

  saveVideo: true,
  videoStride: 25,
  videoSaveFirstFrames: 2,
  displayScale: 8,
  agentSize: 4,

  genomeAnalysisStride: 25,
  displaySampleGenomes: 5,
  genomeComparisonMethod: 1,

  updateGraphLog: true,
  updateGraphLogStride: 25,

  numThreads: 1,

  logDir: './logs/',
  imageDir: './images/',
  graphLogUpdateCommand: '',

  parameterChangeGenerationNumber: 0,
};
