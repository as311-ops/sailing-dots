// sailing.ts -- Segelphysik: Polartabelle, Wind-Zustand, Quadranten-Helfer
// Kern der Sailing-Dots-Simulation. Bewusst ohne Abhängigkeit auf Grid/Peeps,
// damit die Physik isoliert testbar bleibt.

import { Compass } from './types';
import { randomUint } from './random';

// ---------------------------------------------------------------------------
// Kompass <-> Oktant (Winkel in 45°-Schritten, E=0, gegen den Uhrzeigersinn)
// ---------------------------------------------------------------------------

// Index = Compass-Enum-Wert (SW=0..NE=8), Wert = Oktant 0..7, CENTER = -1
const COMPASS_TO_OCTANT: ReadonlyArray<number> = [
  5,  // SW
  6,  // S
  7,  // SE
  4,  // W
  -1, // CENTER
  0,  // E
  3,  // NW
  2,  // N
  1,  // NE
];

const OCTANT_TO_COMPASS: ReadonlyArray<Compass> = [
  Compass.E, Compass.NE, Compass.N, Compass.NW,
  Compass.W, Compass.SW, Compass.S, Compass.SE,
];

export function octantOf(c: Compass): number {
  return COMPASS_TO_OCTANT[c];
}

export function compassFromOctant(octant: number): Compass {
  return OCTANT_TO_COMPASS[((octant % 8) + 8) % 8];
}

/** Winkel eines Kompass-Werts in Radiant (E=0, CCW). */
export function compassAngleRad(c: Compass): number {
  return octantOf(c) * (Math.PI / 4);
}

/**
 * Relativwinkel zweier Richtungen in 45°-Schritten, 0..4.
 * 0 = gleiche Richtung, 4 = entgegengesetzt.
 */
export function relativeOctantSteps(a: Compass, b: Compass): number {
  const d = Math.abs(octantOf(a) - octantOf(b)) % 8;
  return d > 4 ? 8 - d : d;
}

// ---------------------------------------------------------------------------
// Polartabelle
// ---------------------------------------------------------------------------

/**
 * Bootsgeschwindigkeit (= Move-Wahrscheinlichkeit pro Tick) nach Relativwinkel
 * zwischen Heading und Windquelle, in 45°-Schritten:
 *   0 = im Wind (No-Go-Zone), 1 = hart am Wind, 2 = Halbwind,
 *   3 = Raumschots, 4 = vorm Wind.
 */
export const POLAR_TABLE: ReadonlyArray<number> = [0.05, 0.5, 1.0, 0.9, 0.7];

/** Geschwindigkeit für ein Heading bei Wind AUS Richtung windFrom. */
export function polarSpeed(heading: Compass, windFrom: Compass): number {
  return POLAR_TABLE[relativeOctantSteps(heading, windFrom)];
}

// ---------------------------------------------------------------------------
// Quadranten (0=SW, 1=SE, 2=NW, 3=NE — Grid-Koordinaten, y+ = Nord)
// ---------------------------------------------------------------------------

export function quadrantCenter(q: number, sizeX: number, sizeY: number): { x: number; y: number } {
  return {
    x: (q & 1) === 0 ? Math.floor(sizeX / 4) : Math.floor((3 * sizeX) / 4),
    y: (q & 2) === 0 ? Math.floor(sizeY / 4) : Math.floor((3 * sizeY) / 4),
  };
}

export function isInQuadrant(x: number, y: number, q: number, sizeX: number, sizeY: number): boolean {
  const east = x >= Math.floor(sizeX / 2) ? 1 : 0;
  const north = y >= Math.floor(sizeY / 2) ? 2 : 0;
  return (east | north) === q;
}

export const QUADRANT_NAMES: ReadonlyArray<string> = ['SW', 'SE', 'NW', 'NE'];

// ---------------------------------------------------------------------------
// Ziel-Gate und Startaufstellung
// ---------------------------------------------------------------------------

/**
 * Ziel-Gate: horizontales Zellen-Segment zwischen zwei Bojen, zentriert auf
 * dem Quadranten-Zentrum. Gefinisht hat, wer eine Gate-Zelle betritt —
 * außen an den Bojen vorbei zählt nicht. Da Moves max. 1 Zelle pro Tick
 * sind, kann eine 1 Zelle dicke Linie nicht übersprungen werden.
 */
export interface FinishGate {
  y: number;
  x0: number; // erste Gate-Zelle (inklusive)
  x1: number; // letzte Gate-Zelle (inklusive); Bojen bei x0-1 und x1+1
}

export function finishGate(q: number, sizeX: number, sizeY: number): FinishGate {
  const c = quadrantCenter(q, sizeX, sizeY);
  const width = Math.max(16, Math.floor(sizeX / 4));
  const half = Math.floor(width / 2);
  return {
    y: c.y,
    x0: Math.max(1, c.x - half),
    x1: Math.min(sizeX - 2, c.x + half - 1),
  };
}

export function isOnFinishGate(x: number, y: number, gate: FinishGate): boolean {
  return y === gate.y && x >= gate.x0 && x <= gate.x1;
}

/**
 * Startaufstellung: kompakter Block im diagonal gegenüberliegenden
 * Quadranten. Die Boote füllen Reihen hinter der Startlinie, die dem Gate
 * zugewandt ist — alle starten mit (nahezu) gleicher Distanz zum Ziel.
 */
export interface StartBox {
  centerX: number;
  startLineY: number; // Linie liegt gate-seitig VOR der ersten Bootsreihe
  dir: 1 | -1;        // y-Richtung von der Box zum Gate
  cols: number;       // besetzte Zellen pro Reihe (physische Breite = 2 * cols)
}

export function startBox(q: number, sizeX: number, sizeY: number): StartBox {
  const gate = quadrantCenter(q, sizeX, sizeY);
  const s = quadrantCenter(3 - q, sizeX, sizeY);
  const dir: 1 | -1 = gate.y >= s.y ? 1 : -1;
  return {
    centerX: s.x,
    startLineY: s.y + dir * 3,
    dir,
    cols: Math.max(8, Math.floor(sizeX / 5)),
  };
}

/**
 * Grid-Position des i-ten Boots in der Startaufstellung. Die Boote stehen in
 * einem Schachbrettmuster (jede zweite Spalte, pro Reihe um 1 versetzt), damit
 * jedes Boot freie Nachbarzellen hat und sofort lossegeln kann — kein dichter
 * Pulk, der sich erst über viele Ticks entwirren muss.
 */
export function startSlot(
  i: number,
  box: StartBox,
  sizeX: number,
  sizeY: number,
): { x: number; y: number } {
  const row = Math.floor(i / box.cols);
  const col = i % box.cols;
  const px = col * 2 + (row & 1); // Schachbrett-Versatz
  const x = Math.min(sizeX - 1, Math.max(0, box.centerX - box.cols + px));
  const y = Math.min(sizeY - 1, Math.max(0, box.startLineY - box.dir * (1 + row)));
  return { x, y };
}

// ---------------------------------------------------------------------------
// Regatta-Tracking via challengeBits
// ---------------------------------------------------------------------------

/**
 * challengeBits-Layout:
 * Bits 0..15: Ankunfts-Tick · Bit 16: gefinisht ·
 * Bits 17/18: Marke 1/2 gerundet · Bit 19: Frühstart-Strafe
 */
export const REGATTA_TICK_MASK = 0xFFFF;
export const REGATTA_FINISHED_BIT = 0x10000;
export const REGATTA_MARK1_BIT = 0x20000;
export const REGATTA_MARK2_BIT = 0x40000;
export const REGATTA_PENALTY_BIT = 0x80000;

// ---------------------------------------------------------------------------
// Mehrbein-Kurs: Zwischenmarken, die vor dem Gate gerundet werden müssen
// ---------------------------------------------------------------------------

/** Rundungszone um eine Marke. */
export function markRadius(sizeX: number): number {
  return Math.max(3, Math.floor(sizeX / 32));
}

/**
 * Zwischenmarken in Rundungs-Reihenfolge (0, 1 oder 2 Stück).
 * legs=1: direkter Kurs · legs=2: eine Marke im Grid-Zentrum ·
 * legs=3: zwei Marken in den beiden übrigen Quadranten — zuerst die auf
 * Start-Höhe (Halbwind-Schenkel), dann die diagonal gegenüber.
 */
export function courseMarks(
  q: number,
  legs: number,
  sizeX: number,
  sizeY: number,
): Array<{ x: number; y: number }> {
  if (legs <= 1) return [];
  if (legs === 2) {
    return [{ x: Math.floor(sizeX / 2), y: Math.floor(sizeY / 2) }];
  }
  const s = 3 - q;
  const a = (q & 1) | (s & 2); // x-Hälfte des Ziels, y-Hälfte des Starts
  const b = (s & 1) | (q & 2); // x-Hälfte des Starts, y-Hälfte des Ziels
  return [quadrantCenter(a, sizeX, sizeY), quadrantCenter(b, sizeX, sizeY)];
}

/** Anzahl bereits gerundeter Marken (Reihenfolge wird beim Setzen erzwungen). */
export function marksRounded(challengeBits: number): number {
  return (
    ((challengeBits & REGATTA_MARK1_BIT) !== 0 ? 1 : 0) +
    ((challengeBits & REGATTA_MARK2_BIT) !== 0 ? 1 : 0)
  );
}

/** Aktuelles Navigationsziel eines Boots: nächste Marke oder das Gate-Zentrum. */
export function currentObjective(
  challengeBits: number,
  q: number,
  legs: number,
  sizeX: number,
  sizeY: number,
): { x: number; y: number } {
  const marks = courseMarks(q, legs, sizeX, sizeY);
  const done = marksRounded(challengeBits);
  if (done < marks.length) return marks[done];
  return quadrantCenter(q, sizeX, sizeY);
}

// ---------------------------------------------------------------------------
// Sailing-Umgebung (pro Generation konstant, vom Simulator gesetzt)
// ---------------------------------------------------------------------------

export interface SailingEnv {
  /** Richtung, AUS der der Wind weht. */
  windFrom: Compass;
  /** Ziel-Quadrant 0..3. */
  targetQuadrant: number;
}

export const sailingEnv: SailingEnv = {
  windFrom: Compass.N,
  targetQuadrant: 3,
};

export interface SailingParams {
  windMode: 'fixed' | 'rotate' | 'random';
  windDirection: Compass;
  windRotatePeriod: number;
  /** 0..3 fest, -1 = zufällig pro Generation. */
  targetQuadrant: number;
}

/**
 * Setzt Wind und Ziel-Quadrant für die Generation `generation`.
 * Wird vor dem Platzieren der Boote aufgerufen (init + jede neue Generation).
 */
export function advanceSailingGeneration(params: SailingParams, generation: number): void {
  switch (params.windMode) {
    case 'fixed':
      sailingEnv.windFrom = params.windDirection;
      break;
    case 'rotate': {
      const steps = Math.floor(generation / Math.max(1, params.windRotatePeriod));
      sailingEnv.windFrom = compassFromOctant(octantOf(params.windDirection) + steps);
      break;
    }
    case 'random':
      sailingEnv.windFrom = compassFromOctant(randomUint(0, 7));
      break;
  }

  sailingEnv.targetQuadrant =
    params.targetQuadrant >= 0 && params.targetQuadrant <= 3
      ? params.targetQuadrant
      : randomUint(0, 3);
}
