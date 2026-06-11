// simulation.worker.ts -- Web Worker running the simulation loop

import { Simulator, type SimState, type AgentInfo } from '../simulation/simulator';
import type { GenomeProfile } from '../simulation/genome-profile';
import type { ChampionSnapshot } from '../simulation/lineage';
import type { Genome } from '../simulation/types';

interface SimConfig {
  sizeX: number;
  sizeY: number;
  population: number;
  stepsPerGeneration: number;
  maxGenerations: number;
  genomeInitialLength: number;
  maxNumberNeurons: number;
  pointMutationRate: number;
  sexualReproduction: boolean;
  chooseParentsByFitness: boolean;
  windMode: 'fixed' | 'rotate' | 'random';
  windDirection: number;
  windRotatePeriod: number;
  targetQuadrant: number;
  islands: number;
  courseLegs: number;
  preStartTicks: number;
  responsivenessCurveKFactor: number;
}

type WorkerCommand =
  | { type: 'init'; config: SimConfig; seedGenome?: Genome }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'reset'; config: SimConfig; seedGenome?: Genome }
  | { type: 'setSpeed'; fps: number }
  | { type: 'updateConfig'; config: Partial<SimConfig> }
  | { type: 'inspectAgent'; x: number; y: number };

type WorkerMessage =
  | { type: 'state'; state: SimState }
  | { type: 'generation'; stats: { generation: number; survivors: number; population: number; diversity: number; avgFitness: number; finisherRate: number; avgArrivalTick: number; genomeProfile: GenomeProfile | null; championSnapshot: ChampionSnapshot | null } }
  | { type: 'agentInfo'; info: AgentInfo | null }
  | { type: 'perf'; stats: { stepsPerSecond: number; generationsPerSecond: number; stateUpdatesPerSecond: number; avgBurstSteps: number } }
  | { type: 'ready' };

let simulator: Simulator | null = null;
let running = false;
let targetFps = 30;
let stepsPerUpdate = 8;
let animFrameId: ReturnType<typeof setTimeout> | null = null;

const TARGET_SECS_PER_GEN = 7;

function calcStepsPerUpdate(stepsPerGeneration: number): number {
  return Math.max(1, Math.round(stepsPerGeneration / TARGET_SECS_PER_GEN / targetFps));
}

function configToParams(config: SimConfig) {
  return {
    sizeX: config.sizeX,
    sizeY: config.sizeY,
    population: config.population,
    stepsPerGeneration: config.stepsPerGeneration,
    maxGenerations: config.maxGenerations,
    genomeInitialLengthMin: config.genomeInitialLength,
    genomeInitialLengthMax: config.genomeInitialLength,
    maxNumberNeurons: config.maxNumberNeurons,
    pointMutationRate: config.pointMutationRate,
    sexualReproduction: config.sexualReproduction,
    chooseParentsByFitness: config.chooseParentsByFitness,
    windMode: config.windMode,
    windDirection: config.windDirection,
    windRotatePeriod: config.windRotatePeriod,
    targetQuadrant: config.targetQuadrant,
    islands: config.islands,
    courseLegs: config.courseLegs,
    preStartTicks: config.preStartTicks,
    responsivenessCurveKFactor: config.responsivenessCurveKFactor,
  };
}

function post(msg: WorkerMessage, transferables?: Transferable[]): void {
  if (transferables) {
    (self as unknown as Worker).postMessage(msg, transferables);
  } else {
    (self as unknown as Worker).postMessage(msg);
  }
}

function sendState(): void {
  if (!simulator) return;
  const state = simulator.getState();
  post({ type: 'state', state }, [
    state.agentLocations.buffer,
    state.agentColors.buffer,
    state.agentHeadings.buffer,
    state.barrierLocations.buffer,
  ]);
}

function sendGeneration(result: { survivors: number; diversity: number; avgFitness: number; finisherRate: number; avgArrivalTick: number; genomeProfile: GenomeProfile | null; championSnapshot: ChampionSnapshot | null }): void {
  if (!simulator) return;
  post({
    type: 'generation',
    stats: {
      generation: simulator.generation,
      survivors: result.survivors,
      population: simulator.params.population,
      diversity: result.diversity,
      avgFitness: result.avgFitness,
      finisherRate: result.finisherRate,
      avgArrivalTick: result.avgArrivalTick,
      genomeProfile: result.genomeProfile,
      championSnapshot: result.championSnapshot,
    },
  });
}

let perfWindowStart = performance.now();
let perfSteps = 0;
let perfGenerations = 0;
let perfLoops = 0;
let perfBurstSteps = 0;
let perfStateUpdates = 0;

function resetPerfCounters(now: number = performance.now()): void {
  perfWindowStart = now;
  perfSteps = 0;
  perfGenerations = 0;
  perfLoops = 0;
  perfBurstSteps = 0;
  perfStateUpdates = 0;
}

function maybeSendPerf(now: number): void {
  const elapsedMs = now - perfWindowStart;
  if (elapsedMs < 1000) return;

  const elapsedSec = elapsedMs / 1000;
  post({
    type: 'perf',
    stats: {
      stepsPerSecond: perfSteps / elapsedSec,
      generationsPerSecond: perfGenerations / elapsedSec,
      stateUpdatesPerSecond: perfStateUpdates / elapsedSec,
      avgBurstSteps: perfLoops > 0 ? perfBurstSteps / perfLoops : 0,
    },
  });

  resetPerfCounters(now);
}

function simulationLoop(): void {
  if (!running || !simulator) return;
  const loopStart = performance.now();

  try {
    let stepsRun = 0;
    for (let i = 0; i < stepsPerUpdate; i++) {
      const result = simulator.step();
      stepsRun++;
      if (result) {
        perfGenerations++;
        sendGeneration(result);
        break;
      }
    }
    perfSteps += stepsRun;
    perfLoops++;
    perfBurstSteps += stepsRun;

    // Send canvas state every frame for smooth visuals
    sendState();
    perfStateUpdates++;

    maybeSendPerf(performance.now());
  } catch (err) {
    console.error('Simulation error:', err);
    running = false;
    return;
  }

  const elapsed = performance.now() - loopStart;
  const delay = Math.max(0, Math.floor((1000 / Math.max(1, targetFps)) - elapsed));
  animFrameId = setTimeout(simulationLoop, delay);
}

function stopLoop(): void {
  if (animFrameId !== null) {
    clearTimeout(animFrameId);
    animFrameId = null;
  }
}

self.onmessage = (e: MessageEvent<WorkerCommand>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init': {
      simulator = new Simulator(configToParams(msg.config));
      simulator.init(undefined, msg.seedGenome);
      stepsPerUpdate = calcStepsPerUpdate(msg.config.stepsPerGeneration);
      resetPerfCounters();
      sendState();
      post({ type: 'ready' });
      break;
    }

    case 'start': {
      running = true;
      resetPerfCounters();
      simulationLoop();
      break;
    }

    case 'pause': {
      running = false;
      stopLoop();
      break;
    }

    case 'reset': {
      running = false;
      stopLoop();
      simulator = new Simulator(configToParams(msg.config));
      simulator.init(undefined, msg.seedGenome);
      stepsPerUpdate = calcStepsPerUpdate(msg.config.stepsPerGeneration);
      resetPerfCounters();
      sendState();
      break;
    }

    case 'setSpeed': {
      stepsPerUpdate = Math.max(1, msg.fps);
      break;
    }

    case 'inspectAgent': {
      if (simulator) {
        const info = simulator.getAgentInfo(msg.x, msg.y);
        post({ type: 'agentInfo', info });
      }
      break;
    }

    case 'updateConfig': {
      if (simulator && msg.config) {
        const c = msg.config;
        if (c.pointMutationRate !== undefined) simulator.params.pointMutationRate = c.pointMutationRate;
        if (c.responsivenessCurveKFactor !== undefined) simulator.params.responsivenessCurveKFactor = c.responsivenessCurveKFactor;
        if (c.windMode !== undefined) simulator.params.windMode = c.windMode;
        if (c.windDirection !== undefined) simulator.params.windDirection = c.windDirection;
        if (c.windRotatePeriod !== undefined) simulator.params.windRotatePeriod = c.windRotatePeriod;
        if (c.targetQuadrant !== undefined) simulator.params.targetQuadrant = c.targetQuadrant;
        if (c.islands !== undefined) simulator.params.islands = c.islands;
        if (c.courseLegs !== undefined) simulator.params.courseLegs = c.courseLegs;
        if (c.preStartTicks !== undefined) simulator.params.preStartTicks = c.preStartTicks;
        if (c.sexualReproduction !== undefined) simulator.params.sexualReproduction = c.sexualReproduction;
        if (c.chooseParentsByFitness !== undefined) simulator.params.chooseParentsByFitness = c.chooseParentsByFitness;
      }
      break;
    }
  }
};
