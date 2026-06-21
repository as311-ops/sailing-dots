// simulator.ts -- Main simulation engine
// Ported from biosim4: simulator.cpp, endOfSimStep.cpp, endOfGeneration.cpp

import { Coord, Sensor, Action, Indiv, type Genome } from './types';
import { Grid } from './grid';
import { Peeps } from './peeps';
import { Signals } from './signals';
import { SimParams, DEFAULT_PARAMS } from './params';
import { feedForward } from './neural-net';
import { getSensor, SENSOR_NAMES } from './sensors';
import { executeActions } from './actions';
import { seedRng, clearRng } from './random';
import { initializeGeneration0, spawnNewGeneration, type GenerationResult } from './spawn';
import { nameFromGenome, clanFromGenome } from './naming';
import {
  sailingEnv,
  advanceSailingGeneration,
  finishGate,
  isOnFinishGate,
  startBox,
  courseMarks,
  marksRounded,
  markRadius,
  currentObjective,
  compassAngleRad,
  polarSpeed,
  REGATTA_FINISHED_BIT,
  REGATTA_MARK1_BIT,
  REGATTA_MARK2_BIT,
  REGATTA_PENALTY_BIT,
} from './sailing';

// ---------------------------------------------------------------------------
// AgentInfo: detailed info for agent inspector
// ---------------------------------------------------------------------------

export interface AgentInfo {
  index: number;
  name: string;
  clan: string;
  x: number;
  y: number;
  age: number;
  genomeLength: number;
  neuronCount: number;
  connectionCount: number;
  responsiveness: number;
  oscPeriod: number;
  heading: number;
  challengeBits: number;
  sensorValues: { name: string; value: number }[];
  connections: { from: string; to: string; weight: number }[];
}

const ACTION_NAMES = ['TURN_LEFT', 'TURN_RIGHT'];

// ---------------------------------------------------------------------------
// SimState: serializable snapshot for rendering
// ---------------------------------------------------------------------------

export interface SimState {
  generation: number;
  simStep: number;
  population: number;
  survivors: number;
  agentLocations: Float32Array;
  agentColors: Uint8Array;
  agentHeadings: Uint8Array;  // Compass-Werte (0..8) pro lebendem Agent
  agentFinished: Uint8Array;  // 1 = hat die Ziellinie überquert, sonst 0
  barrierLocations: Uint16Array;
  windFrom: number;          // Compass-Wert der Windquelle
  targetQuadrant: number;    // 0..3
  courseLegs: number;        // 1..3, für Marken-Rendering
  preStartTicks: number;     // Vorstart-Dauer, für Startlinien-Rendering
  gridSize: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

export class Simulator {
  grid: Grid;
  peeps: Peeps;
  signals: Signals;
  params: SimParams;

  generation = 0;
  simStep = 0;
  lastSurvivors = 0;

  // Cached rendering data to reduce allocations
  private _cachedColors: Uint8Array | null = null;
  private _colorsGeneration = -1;

  // Pre-allocated callbacks — avoid creating new closures per agent per step
  private _currentIndiv: Indiv | null = null;
  private _currentCacheToken = 0;
  private readonly _getSensorFunc: (sensor: number, simStep: number) => number;

  constructor(params?: Partial<SimParams>) {
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.grid = new Grid();
    this.peeps = new Peeps();
    this.signals = new Signals();
    this._getSensorFunc = (sensor: number, simStep: number) =>
      this.getCachedSensorValue(this._currentIndiv!, sensor as Sensor, simStep, this._currentCacheToken);
  }

  /**
   * Initialize the simulation with the given parameters.
   */
  init(params?: Partial<SimParams>, seedGenome?: Genome): void {
    if (params) {
      this.params = { ...this.params, ...params };
    }

    this.generation = 0;
    this.simStep = 0;
    this.lastSurvivors = 0;

    // Determinismus: einmal pro Lauf seeden, danach fließt ein kontinuierlicher
    // PRNG-Strom durch alle Generationen — gleicher Seed + gleiche Params =
    // Byte-gleicher Lauf. Sonst nicht-deterministisch (Math.random).
    if (this.params.deterministic) {
      seedRng(this.params.RNGSeed);
    } else {
      clearRng();
    }

    this.grid.init(this.params.sizeX, this.params.sizeY);
    this.signals.init(this.params.signalLayers, this.params.sizeX, this.params.sizeY);

    // Wind & Ziel-Quadrant für Generation 0 — vor der Platzierung der Boote
    advanceSailingGeneration(this.params, 0);

    initializeGeneration0(this.peeps, this.grid, this.signals, this.params, seedGenome);
  }

  lastGenerationResult: GenerationResult | null = null;

  /**
   * Advance simulation by one step (all agents think + act, then cleanup).
   * Returns the GenerationResult if a generation just ended, null otherwise.
   */
  step(): GenerationResult | null {
    // Process each agent
    for (let i = 1; i <= this.peeps.population; i++) {
      const indiv = this.peeps.getIndiv(i);
      if (!indiv.alive) continue;
      // Finisher sind aus dem Rennen: sie denken/segeln nicht weiter und geben
      // ihre Grid-Zelle frei (s. endOfSimStep), damit sie das Ziel-Gate nicht
      // für noch racende Boote blockieren (entkoppelt Finisher-Rate vom Gedränge).
      if (indiv.challengeBits & REGATTA_FINISHED_BIT) continue;

      indiv.age++;
      this.simStepOneIndiv(indiv);
    }

    // End-of-step cleanup
    this.endOfSimStep();
    this.simStep++;

    // Check if generation is complete
    if (this.simStep >= this.params.stepsPerGeneration) {
      const result = this.endOfGeneration();
      this.lastSurvivors = result.survivors;
      this.lastGenerationResult = result;
      this.generation++;
      this.simStep = 0;
      return result;
    }

    return null;
  }

  /**
   * Run an entire generation (all sim steps).
   * Returns the generation result.
   */
  runGeneration(): GenerationResult {
    while (this.simStep < this.params.stepsPerGeneration) {
      for (let i = 1; i <= this.peeps.population; i++) {
        const indiv = this.peeps.getIndiv(i);
        if (!indiv.alive) continue;
        if (indiv.challengeBits & REGATTA_FINISHED_BIT) continue; // Finisher eingefroren
        indiv.age++;
        this.simStepOneIndiv(indiv);
      }
      this.endOfSimStep();
      this.simStep++;
    }

    const result = this.endOfGeneration();
    this.lastSurvivors = result.survivors;
    this.generation++;
    this.simStep = 0;
    return result;
  }

  /**
   * Get current state as a serializable snapshot for rendering.
   */
  getState(): SimState {
    // Count alive agents
    let aliveCount = 0;
    for (let i = 1; i <= this.peeps.population; i++) {
      if (this.peeps.getIndiv(i).alive) aliveCount++;
    }

    // Agent locations + headings + finish flag
    const agentLocations = new Float32Array(aliveCount * 2);
    const agentHeadings = new Uint8Array(aliveCount);
    const agentFinished = new Uint8Array(aliveCount);
    let idx = 0;

    for (let i = 1; i <= this.peeps.population; i++) {
      const indiv = this.peeps.getIndiv(i);
      if (!indiv.alive) continue;
      agentLocations[idx * 2] = indiv.loc.x;
      agentLocations[idx * 2 + 1] = indiv.loc.y;
      agentHeadings[idx] = indiv.heading.asInt();
      agentFinished[idx] = (indiv.challengeBits & REGATTA_FINISHED_BIT) !== 0 ? 1 : 0;
      idx++;
    }

    // Cache colors per generation (genome doesn't change within a generation)
    if (this._colorsGeneration !== this.generation || !this._cachedColors) {
      const colors = new Uint8Array(this.peeps.population * 3);
      for (let i = 1; i <= this.peeps.population; i++) {
        const indiv = this.peeps.getIndiv(i);
        const color = genomeColor(indiv);
        colors[(i - 1) * 3] = color[0];
        colors[(i - 1) * 3 + 1] = color[1];
        colors[(i - 1) * 3 + 2] = color[2];
      }
      this._cachedColors = colors;
      this._colorsGeneration = this.generation;
    }

    // Build alive-only colors from cache
    const agentColors = new Uint8Array(aliveCount * 3);
    idx = 0;
    for (let i = 1; i <= this.peeps.population; i++) {
      if (!this.peeps.getIndiv(i).alive) continue;
      agentColors[idx * 3] = this._cachedColors[(i - 1) * 3];
      agentColors[idx * 3 + 1] = this._cachedColors[(i - 1) * 3 + 1];
      agentColors[idx * 3 + 2] = this._cachedColors[(i - 1) * 3 + 2];
      idx++;
    }

    // Barrier locations
    const barriers = this.grid.barrierLocations;
    const barrierLocations = new Uint16Array(barriers.length * 2);
    for (let i = 0; i < barriers.length; i++) {
      barrierLocations[i * 2] = barriers[i].x;
      barrierLocations[i * 2 + 1] = barriers[i].y;
    }

    return {
      generation: this.generation,
      simStep: this.simStep,
      population: aliveCount,
      survivors: this.lastSurvivors,
      agentLocations,
      agentColors,
      agentHeadings,
      agentFinished,
      barrierLocations,
      windFrom: sailingEnv.windFrom as number,
      targetQuadrant: sailingEnv.targetQuadrant,
      courseLegs: this.params.courseLegs,
      preStartTicks: this.params.preStartTicks,
      gridSize: { x: this.params.sizeX, y: this.params.sizeY },
    };
  }

  /**
   * Get detailed info about the agent at grid position (x,y).
   * Returns null if no agent is there.
   */
  getAgentInfo(x: number, y: number): AgentInfo | null {
    const loc = new Coord(x, y);
    if (!this.grid.isInBounds(loc) || !this.grid.isOccupiedAt(loc)) return null;

    const indiv = this.peeps.getIndivAt(loc, this.grid);
    if (!indiv || !indiv.alive) return null;

    // Compute current sensor values
    const sensorValues: { name: string; value: number }[] = [];
    for (let s = 0; s < Sensor.NUM_SENSES; s++) {
      const val = getSensor(indiv, s as Sensor, this.simStep, this.grid, this.peeps, this.signals, this.params);
      sensorValues.push({ name: SENSOR_NAMES[s] ?? `SENSOR_${s}`, value: Math.round(val * 1000) / 1000 });
    }

    // Neural net connections summary
    const connections: { from: string; to: string; weight: number }[] = [];
    for (const conn of indiv.nnet.connections) {
      const fromName = conn.sourceType === 1
        ? SENSOR_NAMES[conn.sourceNum] ?? `S${conn.sourceNum}`
        : `N${conn.sourceNum}`;
      const toName = conn.sinkType === 1
        ? ACTION_NAMES[conn.sinkNum] ?? `A${conn.sinkNum}`
        : `N${conn.sinkNum}`;
      connections.push({ from: fromName, to: toName, weight: Math.round((conn.weight / 8192) * 1000) / 1000 });
    }

    return {
      index: indiv.index,
      name: nameFromGenome(indiv.genome),
      clan: clanFromGenome(indiv.genome),
      x: indiv.loc.x,
      y: indiv.loc.y,
      age: indiv.age,
      genomeLength: indiv.genome.length,
      neuronCount: indiv.nnet.neurons.length,
      connectionCount: indiv.nnet.connections.length,
      responsiveness: Math.round(indiv.responsiveness * 1000) / 1000,
      oscPeriod: indiv.oscPeriod,
      heading: indiv.heading.asInt(),
      challengeBits: indiv.challengeBits,
      sensorValues,
      connections,
    };
  }

  // ---- Private methods ----

  private simStepOneIndiv(indiv: Indiv): void {
    let sensorCacheToken = (indiv.sensorCacheToken + 1) >>> 0;
    if (sensorCacheToken === 0) {
      indiv.sensorCacheEpochs.fill(0);
      sensorCacheToken = 1;
    }
    indiv.sensorCacheToken = sensorCacheToken;

    // Set context for pre-allocated callbacks — no new closures
    this._currentIndiv = indiv;
    this._currentCacheToken = sensorCacheToken;

    const actionLevels = feedForward(
      indiv.nnet,
      this.simStep,
      this._getSensorFunc,
      { numActions: Action.NUM_ACTIONS },
    );

    executeActions(indiv, actionLevels, this.grid, this.peeps, this.signals, this.params);
  }

  private getCachedSensorValue(
    indiv: Indiv,
    sensor: Sensor,
    simStep: number,
    cacheToken: number,
  ): number {
    if (indiv.sensorCacheEpochs[sensor] !== cacheToken) {
      indiv.sensorCacheValues[sensor] = getSensor(
        indiv,
        sensor,
        simStep,
        this.grid,
        this.peeps,
        this.signals,
        this.params,
      );
      indiv.sensorCacheEpochs[sensor] = cacheToken;
    }

    return indiv.sensorCacheValues[sensor];
  }

  private endOfSimStep(): void {
    // Drain queues first, damit die Quadranten-Prüfung die Position NACH dem
    // Move dieses Ticks sieht und der Ankunfts-Tick exakt stimmt
    this.peeps.drainDeathQueue(this.grid);
    this.peeps.drainMoveQueue(this.grid);

    const preStart = this.params.preStartTicks;

    // Startschuss: Boote, die jetzt jenseits der Startlinie stehen, kassieren
    // die Frühstart-Strafe (sie segeln weiter, ihr Score wird gestutzt)
    if (preStart > 0 && this.simStep === preStart) {
      const box = startBox(sailingEnv.targetQuadrant, this.params.sizeX, this.params.sizeY);
      for (let i = 1; i <= this.peeps.population; i++) {
        const indiv = this.peeps.getIndiv(i);
        if (!indiv.alive) continue;
        if ((indiv.loc.y - box.startLineY) * box.dir > 0) {
          indiv.challengeBits |= REGATTA_PENALTY_BIT;
        }
      }
    }

    // Vor dem Startschuss wird nicht gewertet — die Flotte manövriert nur
    if (this.simStep < preStart) return;

    // Regatta: Marken in Reihenfolge runden, dann durchs Ziel-Gate
    const gate = finishGate(sailingEnv.targetQuadrant, this.params.sizeX, this.params.sizeY);
    const marks = courseMarks(sailingEnv.targetQuadrant, this.params.courseLegs, this.params.sizeX, this.params.sizeY);
    const mRadius = markRadius(this.params.sizeX);

    for (let i = 1; i <= this.peeps.population; i++) {
      const indiv = this.peeps.getIndiv(i);
      if (!indiv.alive) continue;
      if (indiv.challengeBits & REGATTA_FINISHED_BIT) continue;

      // VMG-Shaping: belohnt produktives Segeln zum aktuellen Ziel pro Tick.
      // VMG = Bootsgeschwindigkeit * cos(Winkel zwischen Heading und Zielpeilung).
      // No-Go (Speed 0.05) und Wegsegeln (cos<0) liefern beide ~0 — das schiebt
      // die Evolution aus dem Überpinsch-Optimum Richtung 45°-Schlag (vgl. E2).
      const obj = currentObjective(
        indiv.challengeBits, sailingEnv.targetQuadrant, this.params.courseLegs, this.params.sizeX, this.params.sizeY,
      );
      const ox = obj.x - indiv.loc.x;
      const oy = obj.y - indiv.loc.y;
      const od = Math.sqrt(ox * ox + oy * oy);
      if (od > 0) {
        const a = compassAngleRad(indiv.heading.dir9);
        const cos = (Math.cos(a) * ox + Math.sin(a) * oy) / od;
        indiv.vmgAccum += polarSpeed(indiv.heading.dir9, sailingEnv.windFrom) * cos;
      }
      indiv.vmgTicks += 1;

      const done = marksRounded(indiv.challengeBits);
      if (done < marks.length) {
        const m = marks[done];
        const dx = indiv.loc.x - m.x;
        const dy = indiv.loc.y - m.y;
        if (Math.sqrt(dx * dx + dy * dy) <= mRadius) {
          indiv.challengeBits |= done === 0 ? REGATTA_MARK1_BIT : REGATTA_MARK2_BIT;
        }
      } else if (isOnFinishGate(indiv.loc.x, indiv.loc.y, gate)) {
        indiv.challengeBits |= REGATTA_FINISHED_BIT | Math.min(0xFFFF, this.simStep);
        // Zelle freigeben: der Finisher ist durch und soll den Gate-Bereich
        // nicht weiter belegen (er bleibt für das Rendering an indiv.loc stehen).
        this.grid.set(indiv.loc, 0);
      }
    }
  }

  private endOfGeneration(): GenerationResult {
    return spawnNewGeneration(
      this.peeps,
      this.grid,
      this.signals,
      this.params,
      this.generation,
    );
  }
}

// ---------------------------------------------------------------------------
// Genome-based color generation
// ---------------------------------------------------------------------------

/**
 * Genome-based color that reflects genetic relatedness:
 *
 * - HUE from genes 0-1 (clan identity) → same clan = same color family
 *   Uses a smooth mapping so similar first genes = nearby hues.
 *
 * - SATURATION from genes 2-3 (secondary traits) → variation within clan
 *   Keeps colors vivid but distinguishable.
 *
 * - LIGHTNESS from genes 4+ (individual variation) → subtle differences
 *   Within the same clan+subgroup, individuals vary in brightness.
 *
 * Result: visually, you can spot related clusters — they share a color.
 * As evolution converges, the grid becomes more monochromatic.
 */
function genomeColor(indiv: Indiv): [number, number, number] {
  const genome = indiv.genome;
  if (genome.length === 0) return [128, 128, 128];

  const g0 = genome[0];
  const g1 = genome.length > 1 ? genome[1] : g0;
  const g2 = genome.length > 2 ? genome[2] : g0;
  const g3 = genome.length > 3 ? genome[3] : g1;

  // Hue: derived from genes 0+1 — the "clan" genes
  // Uses sourceType, sourceNum, sinkType, sinkNum (NOT weight, which mutates too fast)
  const clanHash =
    (g0.sourceType * 128 + g0.sourceNum) * 256 +
    (g0.sinkType * 128 + g0.sinkNum) +
    (g1.sourceType * 64 + (g1.sourceNum & 0x3F)) * 7;
  const hue = (clanHash * 137) % 360; // golden-angle-ish spread for good distribution

  // Saturation: genes 2+3 add variation — 0.55..0.85
  const subHash = ((g2.sourceNum ^ g3.sinkNum) + g2.sinkType * 50) & 0xFF;
  const sat = 0.55 + (subHash % 30) / 100;

  // Lightness: subtle individual variation — 0.4..0.65
  let indivHash = 0;
  for (let i = 0; i < Math.min(genome.length, 8); i++) {
    indivHash = (indivHash * 17 + genome[i].weight) & 0xFFFF;
  }
  const lit = 0.4 + (indivHash % 25) / 100;

  return hslToRgb(hue / 360, sat, lit);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
  ];
}
