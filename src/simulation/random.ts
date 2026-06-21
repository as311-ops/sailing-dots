// random.ts -- Seedbare RNG-Utilities
//
// Standardmäßig nicht-deterministisch (Math.random). Über seedRng() lässt sich
// ein deterministischer PRNG (mulberry32) aktivieren — für reproduzierbare Läufe
// und teilbare "Saat-Rennen". Der Simulator ruft seedRng/clearRng in init() auf,
// abhängig von params.deterministic. ALLE simulationsrelevante Zufälligkeit läuft
// durch diese Funktionen (genome, headings, grid, wind) — nur UI-Text (commentary)
// nutzt weiterhin Math.random direkt.

let prng: (() => number) | null = null;

/** Deterministischer PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Aktiviert einen deterministischen, seedbaren PRNG für reproduzierbare Läufe. */
export function seedRng(seed: number): void {
  prng = mulberry32(seed);
}

/** Schaltet zurück auf Math.random (nicht-deterministisch). */
export function clearRng(): void {
  prng = null;
}

/** True, wenn aktuell ein deterministischer Seed aktiv ist. */
export function isSeeded(): boolean {
  return prng !== null;
}

/**
 * Returns a random float in the range [0, 1).
 */
export function randomFloat(): number {
  return prng ? prng() : Math.random();
}

/**
 * Returns a random integer in the range [min, max] inclusive.
 */
export function randomUint(min: number, max: number): number {
  return min + Math.floor(randomFloat() * (max - min + 1));
}
