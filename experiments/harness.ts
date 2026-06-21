// harness.ts -- Wiederverwendbare Bausteine für die Sailing-Dots-Forschungsreihe.
//
// Treibt die Simulation headless (ohne Worker/Browser), seedet den RNG
// reproduzierbar und stellt Kurs-Presets, Statistik- und Markdown-Helfer bereit.
// Importiert nur aus src/ — die Simulation selbst bleibt unangetastet.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Simulator } from '../src/simulation/simulator';
import { Compass, type Genome } from '../src/simulation/types';
import type { SimParams } from '../src/simulation/params';
import type { GenerationResult } from '../src/simulation/spawn';
import {
  sailingEnv,
  octantOf,
  relativeOctantSteps,
  POLAR_TABLE,
  REGATTA_FINISHED_BIT,
} from '../src/simulation/sailing';

export type { GenerationResult };
export { Compass, sailingEnv, relativeOctantSteps, POLAR_TABLE, REGATTA_FINISHED_BIT };

// ---------------------------------------------------------------------------
// Reproduzierbarer RNG
// ---------------------------------------------------------------------------

/** Deterministischer PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Führt `fn` mit auf `seed` festgenageltem Math.random aus und stellt das
 * Original danach wieder her. Garantiert identische Startpopulationen über
 * verschiedene Konfigurationen hinweg (nur die getestete Variable ändert sich).
 */
export function withSeed<T>(seed: number, fn: () => T): T {
  const orig = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

// ---------------------------------------------------------------------------
// Kurs-Presets — Ziel fest NE (Quadrant 3, Start SW). Nur der Wind variiert,
// dadurch durchläuft man exakt die Polartabelle (Point of Sail).
//   Rhumb-Linie SW->NE = Heading NE (Oktant 1).
//   relativeOctantSteps(NE, windFrom) liefert den Polar-Index.
// ---------------------------------------------------------------------------

export const TARGET_NE = 3;

export interface Course {
  key: string;
  label: string;
  windDirection: Compass;
  targetQuadrant: number;
  /** Index in POLAR_TABLE für die direkte Kurslinie zum Ziel. */
  polarIndex: number;
  /** Bootsgeschwindigkeit auf der direkten Linie (= POLAR_TABLE[polarIndex]). */
  rhumbSpeed: number;
}

function course(key: string, label: string, wind: Compass): Course {
  const polarIndex = relativeOctantSteps(Compass.NE, wind);
  return {
    key,
    label,
    windDirection: wind,
    targetQuadrant: TARGET_NE,
    polarIndex,
    rhumbSpeed: POLAR_TABLE[polarIndex],
  };
}

export const COURSES = {
  beat: course('beat', 'Beat (dead upwind)', Compass.NE), // index 0, 0.05 — Kreuzen nötig
  closehauled: course('closehauled', 'Close-hauled', Compass.N), // index 1, 0.5
  beam: course('beam', 'Beam reach', Compass.SE), // index 2, 1.0 — schnellster
  broad: course('broad', 'Broad reach', Compass.S), // index 3, 0.9
  run: course('run', 'Run (downwind)', Compass.SW), // index 4, 0.7
} as const;

export const POINT_OF_SAIL = ['In irons (no-go)', 'Close-hauled', 'Beam reach', 'Broad reach', 'Run'];

// ---------------------------------------------------------------------------
// Simulation treiben
// ---------------------------------------------------------------------------

/** Sinnvolle Defaults für Headless-Experimente (große Arena, 300 Boote). */
export const BASE: Partial<SimParams> = {
  sizeX: 160,
  sizeY: 160,
  population: 300,
  stepsPerGeneration: 600,
  windMode: 'fixed',
  genomeInitialLengthMin: 24,
  genomeInitialLengthMax: 24,
};

export interface EvolutionRun {
  series: GenerationResult[];
  champion: Genome | null;
}

/**
 * Evolviert eine Population über `gens` Generationen und sammelt je Generation
 * das GenerationResult. `champion` ist das beste Genom der letzten Generation.
 */
export function runEvolution(config: Partial<SimParams>, gens: number): EvolutionRun {
  const sim = new Simulator({ ...BASE, ...config });
  sim.init();
  const series: GenerationResult[] = [];
  let champion: Genome | null = null;
  for (let g = 0; g < gens; g++) {
    const r = sim.runGeneration();
    series.push(r);
    if (r.championGenome) champion = r.championGenome;
  }
  return { series, champion };
}

/**
 * Treibt EINE Generation Tick für Tick und ruft `onTick` nach jedem nicht-
 * finalen Schritt auf (Boote noch in dieser Generation, vor dem Respawn).
 * Für Verhaltens-Sampling (E2).
 */
export function runGenerationStepwise(
  sim: Simulator,
  onTick: (sim: Simulator, step: number) => void,
): GenerationResult {
  for (;;) {
    const r = sim.step();
    if (r) return r; // Generation beendet, Boote bereits neu gespawnt
    onTick(sim, sim.simStep);
  }
}

/**
 * Bewertet ein fixes Genom auf einer Kurs-Bedingung OHNE Evolution: die
 * Population besteht aus exakten Klonen (Mutation eingefroren), 1 Generation.
 */
export function evaluateGenome(
  genome: Genome,
  condition: { windDirection: Compass; targetQuadrant: number },
  opts: { population?: number; stepsPerGeneration?: number } = {},
): { finisherRate: number; avgArrivalTick: number } {
  const sim = new Simulator({
    ...BASE,
    windMode: 'fixed',
    windDirection: condition.windDirection,
    targetQuadrant: condition.targetQuadrant,
    population: opts.population ?? 300,
    stepsPerGeneration: opts.stepsPerGeneration ?? BASE.stepsPerGeneration,
    pointMutationRate: 0,
    geneInsertionDeletionRate: 0,
  });
  sim.init(undefined, genome);
  const r = sim.step.bind(sim);
  let result: GenerationResult | null = null;
  while (result === null) result = r();
  return { finisherRate: result.finisherRate, avgArrivalTick: result.avgArrivalTick };
}

// ---------------------------------------------------------------------------
// Heading-Analyse (für E2)
// ---------------------------------------------------------------------------

/** Polar-Index (0..4) des aktuellen Segelwinkels eines Headings zum Wind. */
export function sailIndex(heading: Compass, windFrom: Compass): number {
  return relativeOctantSteps(heading, windFrom);
}

/**
 * Vorzeichenbehaftete Oktant-Differenz Heading-zu-Wind, normiert auf -4..4.
 * Unterscheidet die beiden Kreuz-Schläge (Backbord/Steuerbord) auf einem Beat.
 */
export function signedTackSide(heading: Compass, windFrom: Compass): number {
  let d = (octantOf(heading) - octantOf(windFrom)) % 8;
  if (d > 4) d -= 8;
  if (d < -4) d += 8;
  return d;
}

// ---------------------------------------------------------------------------
// Statistik-Helfer
// ---------------------------------------------------------------------------

export const mean = (a: number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function std(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
}

export const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Mittel der letzten k Elemente. */
export const meanLastK = (a: number[], k: number): number => mean(a.slice(-k));

/** Mittel, das -1-Sentinels (z.B. avgArrivalTick ohne Finisher) ignoriert. */
export const meanValid = (a: number[]): number => {
  const v = a.filter((x) => x >= 0);
  return v.length ? mean(v) : -1;
};

/** Erste Generation, in der `key` den Schwellwert erreicht (-1 = nie). */
export function gensToThreshold(
  series: GenerationResult[],
  key: keyof GenerationResult,
  thr: number,
): number {
  const i = series.findIndex((r) => (r[key] as number) >= thr);
  return i;
}

export const pct = (x: number): string => (x * 100).toFixed(1);

// ---------------------------------------------------------------------------
// Markdown- & Datei-Helfer
// ---------------------------------------------------------------------------

const SPARK = '▁▂▃▄▅▆▇█';

/** Sparkline einer auf [0,1] normierten (oder zu normierenden) Serie. */
export function sparkline(values: number[], min = 0, max = 1): string {
  return values
    .map((v) => {
      const t = Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
      return SPARK[Math.round(t * (SPARK.length - 1))];
    })
    .join('');
}

/** Horizontaler ASCII-Balken (für Tabellen/Histogramme). */
export function bar(value: number, max: number, width = 24): string {
  const n = Math.round((Math.max(0, value) / (max || 1)) * width);
  return '█'.repeat(n) + '·'.repeat(Math.max(0, width - n));
}

/** Markdown-Tabelle aus Header + Zeilen. */
export function mdTable(header: string[], rows: (string | number)[][]): string {
  const fmt = (v: string | number) => (typeof v === 'number' ? String(v) : v);
  const head = `| ${header.join(' | ')} |`;
  const sep = `| ${header.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map(fmt).join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

const HERE = dirname(fileURLToPath(import.meta.url));
const RESEARCH_DIR = resolve(HERE, '..', 'docs', 'research');

/** Schreibt ein Paper nach docs/research/<slug>.md. */
export function writePaper(slug: string, markdown: string): string {
  mkdirSync(RESEARCH_DIR, { recursive: true });
  const path = resolve(RESEARCH_DIR, `${slug}.md`);
  writeFileSync(path, markdown.trimStart() + '\n', 'utf8');
  return path;
}

/** Schreibt Rohdaten nach docs/research/data/<slug>.csv. */
export function writeCsv(slug: string, header: string[], rows: (string | number)[][]): string {
  const dir = resolve(RESEARCH_DIR, 'data');
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, `${slug}.csv`);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  writeFileSync(path, csv + '\n', 'utf8');
  return path;
}

/** Konsolen-Fortschritt. */
export function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}
