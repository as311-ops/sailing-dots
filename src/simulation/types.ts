// types.ts -- Core types and data structures
// Ported from biosim4: basicTypes.h/cpp, genome-neurons.h, indiv.h, sensors-actions.h

import { randomUint } from './random';

// ---------------------------------------------------------------------------
// Grid cell constants
// ---------------------------------------------------------------------------
export const EMPTY: number = 0;
export const BARRIER: number = 0xFFFF;

// ---------------------------------------------------------------------------
// Sensor value ranges (from sensors-actions.h)
// ---------------------------------------------------------------------------
export const SENSOR_MIN = 0.0;
export const SENSOR_MAX = 1.0;
export const SENSOR_RANGE = SENSOR_MAX - SENSOR_MIN;

export const NEURON_MIN = -1.0;
export const NEURON_MAX = 1.0;
export const NEURON_RANGE = NEURON_MAX - NEURON_MIN;

export const ACTION_MIN = 0.0;
export const ACTION_MAX = 1.0;
export const ACTION_RANGE = ACTION_MAX - ACTION_MIN;

// ---------------------------------------------------------------------------
// Compass / Dir
// ---------------------------------------------------------------------------

/**
 * Compass directions as arithmetic values:
 *   6(NW)  7(N)  8(NE)
 *   3(W)   4(C)  5(E)
 *   0(SW)  1(S)  2(SE)
 */
export enum Compass {
  SW = 0, S = 1, SE = 2,
  W = 3, CENTER = 4, E = 5,
  NW = 6, N = 7, NE = 8,
}

// Pre-computed conversion table for Coord.asDir() — module-level to avoid
// per-call allocation (called once per queued move in drainMoveQueue).
const asDirConversion: Compass[] = [
  Compass.S, Compass.CENTER, Compass.SW, Compass.N,
  Compass.SE, Compass.E, Compass.N, Compass.N,
  Compass.N, Compass.N, Compass.W, Compass.NW,
  Compass.N, Compass.NE, Compass.N, Compass.N,
];

// Pre-computed rotation table: rotations[dir * 8 + (n & 7)]
// Each row is for one compass value, columns are rotation steps 0..7
const rotations: Compass[] = [
  // SW rotated by 0..7
  Compass.SW, Compass.W, Compass.NW, Compass.N, Compass.NE, Compass.E, Compass.SE, Compass.S,
  // S
  Compass.S, Compass.SW, Compass.W, Compass.NW, Compass.N, Compass.NE, Compass.E, Compass.SE,
  // SE
  Compass.SE, Compass.S, Compass.SW, Compass.W, Compass.NW, Compass.N, Compass.NE, Compass.E,
  // W
  Compass.W, Compass.NW, Compass.N, Compass.NE, Compass.E, Compass.SE, Compass.S, Compass.SW,
  // CENTER (rotation is identity)
  Compass.CENTER, Compass.CENTER, Compass.CENTER, Compass.CENTER, Compass.CENTER, Compass.CENTER, Compass.CENTER, Compass.CENTER,
  // E
  Compass.E, Compass.SE, Compass.S, Compass.SW, Compass.W, Compass.NW, Compass.N, Compass.NE,
  // NW
  Compass.NW, Compass.N, Compass.NE, Compass.E, Compass.SE, Compass.S, Compass.SW, Compass.W,
  // N
  Compass.N, Compass.NE, Compass.E, Compass.SE, Compass.S, Compass.SW, Compass.W, Compass.NW,
  // NE
  Compass.NE, Compass.E, Compass.SE, Compass.S, Compass.SW, Compass.W, Compass.NW, Compass.N,
];

/**
 * Normalized coordinates for each compass direction.
 * Index matches Compass enum value.
 *   SW(-1,-1) S(0,-1) SE(1,-1)
 *   W(-1, 0)  C(0, 0) E(1, 0)
 *   NW(-1, 1) N(0, 1) NE(1, 1)
 */
const normalizedCoords: ReadonlyArray<{ x: number; y: number }> = [
  { x: -1, y: -1 }, // SW
  { x:  0, y: -1 }, // S
  { x:  1, y: -1 }, // SE
  { x: -1, y:  0 }, // W
  { x:  0, y:  0 }, // CENTER
  { x:  1, y:  0 }, // E
  { x: -1, y:  1 }, // NW
  { x:  0, y:  1 }, // N
  { x:  1, y:  1 }, // NE
];

/**
 * Dir represents one of the eight compass directions plus CENTER.
 */
export class Dir {
  public readonly dir9: Compass;

  constructor(dir: Compass = Compass.CENTER) {
    this.dir9 = dir;
  }

  static random8(): Dir {
    return new Dir(Compass.N).rotate(randomUint(0, 7));
  }

  asInt(): number {
    return this.dir9 as number;
  }

  asNormalizedCoord(): Coord {
    const nc = normalizedCoords[this.dir9];
    return new Coord(nc.x, nc.y);
  }

  asNormalizedPolar(): Polar {
    return new Polar(1, this.dir9);
  }

  rotate(n: number = 0): Dir {
    return new Dir(rotations[this.dir9 * 8 + (n & 7)]);
  }

  rotate90DegCW(): Dir {
    return this.rotate(2);
  }

  rotate90DegCCW(): Dir {
    return this.rotate(-2 & 7); // -2 mod 8 = 6
  }

  rotate180Deg(): Dir {
    return this.rotate(4);
  }

  equals(other: Dir): boolean {
    return this.dir9 === other.dir9;
  }

  equalsCompass(c: Compass): boolean {
    return this.dir9 === c;
  }
}

// ---------------------------------------------------------------------------
// Coord
// ---------------------------------------------------------------------------

/**
 * Coord represents a signed 2D coordinate (int16 range).
 * Used for grid locations or differences between locations.
 */
export class Coord {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    // Clamp to int16 range
    this.x = x | 0;
    this.y = y | 0;
  }

  isNormalized(): boolean {
    return this.x >= -1 && this.x <= 1 && this.y >= -1 && this.y <= 1;
  }

  /**
   * Length: Euclidean distance, rounded down (integer).
   */
  length(): number {
    return Math.floor(Math.sqrt(this.x * this.x + this.y * this.y));
  }

  /**
   * Converts to a Dir using the optimized rotation method from the C++ code.
   * Uses rational approximation of tan(22.5 degrees) to determine direction.
   */
  asDir(): Dir {
    const tanN = 13860;
    const tanD = 33461;

    const xp = this.x * tanD + this.y * tanN;
    const yp = this.y * tanD - this.x * tanN;

    const idx =
      (yp > 0 ? 8 : 0) +
      (xp > 0 ? 4 : 0) +
      (yp > xp ? 2 : 0) +
      (yp >= -xp ? 1 : 0);

    return new Dir(asDirConversion[idx]);
  }

  asPolar(): Polar {
    return new Polar(this.length(), this.asDir().dir9);
  }

  /**
   * Normalize to a unit-ish direction coord via asDir().asNormalizedCoord().
   */
  normalize(): Coord {
    return this.asDir().asNormalizedCoord();
  }

  /**
   * Cosine similarity: returns -1.0 (opposite) .. 1.0 (same direction).
   * Returns 1.0 if either vector is (0,0).
   */
  raySameness(other: Coord | Dir): number {
    if (other instanceof Dir) {
      return this.raySameness(other.asNormalizedCoord());
    }
    const mag =
      (this.x * this.x + this.y * this.y) *
      (other.x * other.x + other.y * other.y);
    if (mag === 0) {
      return 1.0;
    }
    return (this.x * other.x + this.y * other.y) / Math.sqrt(mag);
  }

  // Arithmetic
  add(other: Coord | Dir): Coord {
    if (other instanceof Dir) {
      return this.add(other.asNormalizedCoord());
    }
    return new Coord(this.x + other.x, this.y + other.y);
  }

  subtract(other: Coord | Dir): Coord {
    if (other instanceof Dir) {
      return this.subtract(other.asNormalizedCoord());
    }
    return new Coord(this.x - other.x, this.y - other.y);
  }

  multiply(a: number): Coord {
    return new Coord(this.x * a, this.y * a);
  }

  equals(other: Coord): boolean {
    return this.x === other.x && this.y === other.y;
  }
}

// ---------------------------------------------------------------------------
// Polar
// ---------------------------------------------------------------------------

/**
 * Polar coordinate with signed magnitude and compass direction.
 */
export class Polar {
  public mag: number;
  public dir: Dir;

  constructor(mag: number = 0, dir: Compass | Dir = Compass.CENTER) {
    this.mag = mag;
    this.dir = dir instanceof Dir ? dir : new Dir(dir);
  }

  /**
   * Convert polar to Cartesian Coord using the same fixed-point logic
   * as the C++ code (1/sqrt(2) approximation for diagonal directions).
   */
  asCoord(): Coord {
    // For TS we use floating-point rather than int64 fixed-point,
    // but produce equivalent results.
    const INV_SQRT2 = 0.7071067811865476; // 1/sqrt(2)
    const coordMags: number[] = [
      INV_SQRT2, // SW
      1.0,       // S
      INV_SQRT2, // SE
      1.0,       // W
      0.0,       // CENTER
      1.0,       // E
      INV_SQRT2, // NW
      1.0,       // N
      INV_SQRT2, // NE
    ];

    const len = Math.round(coordMags[this.dir.asInt()] * this.mag);
    const nc = this.dir.asNormalizedCoord();
    return nc.multiply(len);
  }
}

// ---------------------------------------------------------------------------
// Gene / Genome
// ---------------------------------------------------------------------------

export const SENSOR_TYPE = 1; // sourceType value for sensor
export const ACTION_TYPE = 1; // sinkType value for action
export const NEURON_TYPE = 0; // sourceType or sinkType value for internal neuron

export interface Gene {
  sourceType: number; // 0 = NEURON, 1 = SENSOR
  sourceNum: number;  // 7-bit (0..127)
  sinkType: number;   // 0 = NEURON, 1 = ACTION
  sinkNum: number;    // 7-bit (0..127)
  weight: number;     // signed 16-bit weight (-32768..32767)
}

/**
 * Compute the float weight from the integer weight.
 * Matches C++: weight / 8192.0
 */
export function geneWeightAsFloat(gene: Gene): number {
  return gene.weight / 8192.0;
}

/**
 * Create a random int16 weight value.
 */
export function makeRandomWeight(): number {
  return randomUint(0, 0xFFFF) - 0x8000;
}

export type Genome = Gene[];

// ---------------------------------------------------------------------------
// Neuron / NeuralNet
// ---------------------------------------------------------------------------

export interface Neuron {
  output: number;
  driven: boolean; // undriven neurons have fixed output values
}

export interface NeuralNet {
  connections: Gene[];
  neurons: Neuron[];
  actionScratch: Float32Array;
  neuronScratch: Float32Array;
}

export const INITIAL_NEURON_OUTPUT = 0.5;

// ---------------------------------------------------------------------------
// Indiv
// ---------------------------------------------------------------------------

export interface Indiv {
  alive: boolean;
  index: number;       // index into peeps[] (uint16)
  loc: Coord;          // current location in grid
  birthLoc: Coord;
  age: number;
  genome: Genome;
  nnet: NeuralNet;
  responsiveness: number; // 0.0..1.0
  oscPeriod: number;      // oscillator period
  longProbeDist: number;  // distance for long forward probe
  lastMoveDir: Dir;
  heading: Dir;           // Bootsausrichtung (eine der 8 Richtungen, nie CENTER)
  speedEMA: number;       // gleitender Mittelwert erfolgreicher Moves (0..1)
  challengeBits: number;  // bits set when indiv accomplishes challenge tasks
  sensorCacheValues: Float32Array;
  sensorCacheEpochs: Uint32Array;
  sensorCacheToken: number;
}

/**
 * Create a default (dead) Indiv.
 */
export function createDefaultIndiv(): Indiv {
  return {
    alive: false,
    index: 0,
    loc: new Coord(),
    birthLoc: new Coord(),
    age: 0,
    genome: [],
    nnet: {
      connections: [],
      neurons: [],
      actionScratch: new Float32Array(Action.NUM_ACTIONS),
      neuronScratch: new Float32Array(0),
    },
    responsiveness: 0.5,
    oscPeriod: 34,
    longProbeDist: 16,
    lastMoveDir: new Dir(Compass.CENTER),
    heading: new Dir(Compass.N),
    speedEMA: 0,
    challengeBits: 0,
    sensorCacheValues: new Float32Array(Sensor.NUM_SENSES),
    sensorCacheEpochs: new Uint32Array(Sensor.NUM_SENSES),
    sensorCacheToken: 0,
  };
}

// ---------------------------------------------------------------------------
// Sensor enum — Segel-Sensorik
// ---------------------------------------------------------------------------
export enum Sensor {
  WIND_REL_X = 0,  // cos des Windwinkels relativ zum Heading
  WIND_REL_Y,      // sin des Windwinkels relativ zum Heading
  TARGET_REL_X,    // cos der Peilung zum aktuellen Kursziel (Marke/Gate) relativ zum Heading
  TARGET_REL_Y,    // sin der Peilung zum aktuellen Kursziel relativ zum Heading
  TARGET_DIST,     // Distanz zum aktuellen Kursziel (normalisiert auf Grid-Diagonale)
  BOUNDARY_DIST,
  SPEED,           // gleitender Mittelwert der letzten Moves
  OSC1,
  AGE,
  RANDOM,
  OBSTACLE_FWD,    // freie Strecke voraus (Inseln/Rand), 1.0 = frei
  NUM_SENSES,
}

// ---------------------------------------------------------------------------
// Action enum — das Netz steuert nur das Ruder, Vortrieb kommt vom Wind
// ---------------------------------------------------------------------------
export enum Action {
  TURN_LEFT = 0,
  TURN_RIGHT,
  NUM_ACTIONS,
}

// ---------------------------------------------------------------------------
// Challenge enum
// ---------------------------------------------------------------------------
export enum Challenge {
  CHALLENGE_REGATTA = 0,
}
