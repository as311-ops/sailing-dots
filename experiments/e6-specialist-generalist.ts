// E6 -- Specialist vs. generalist: generalisation across wind directions.
// Train one lineage on a single fixed wind, another on random winds (target
// fixed NE in both). Then freeze evolution and test both champions on a hold-out
// battery of all 8 wind directions. Classic overfitting vs robustness: the
// specialist should spike on its training wind and collapse off-distribution;
// the generalist should be robustly mediocre everywhere.

import {
  COURSES,
  Compass,
  relativeOctantSteps,
  POINT_OF_SAIL,
  runEvolution,
  evaluateGenome,
  withSeed,
  mean,
  meanLastK,
  bar,
  mdTable,
  writePaper,
  writeCsv,
  pct,
  log,
} from './harness';

const GENS = 60;
const SEED = 1;
const TARGET = COURSES.beat.targetQuadrant; // NE
const TRAIN_WIND = Compass.N; // specialist trains close-hauled
const BATTERY: Compass[] = [Compass.SW, Compass.S, Compass.SE, Compass.W, Compass.E, Compass.NW, Compass.N, Compass.NE];
const WIND_NAME = ['SW', 'S', 'SE', 'W', 'C', 'E', 'NW', 'N', 'NE'];

log('E6 — Specialist vs. generalist');

// Train specialist (fixed wind) and generalist (random wind).
const specialist = withSeed(SEED, () =>
  runEvolution({ windMode: 'fixed', windDirection: TRAIN_WIND, targetQuadrant: TARGET }, GENS),
);
const generalist = withSeed(SEED, () =>
  runEvolution({ windMode: 'random', targetQuadrant: TARGET }, GENS),
);
log(`  specialist trained @ ${WIND_NAME[TRAIN_WIND]}: ${pct(meanLastK(specialist.series.map((s) => s.finisherRate), 8))}%`);
log(`  generalist trained @ random: ${pct(meanLastK(generalist.series.map((s) => s.finisherRate), 8))}%`);

// Evaluate both champions across the wind battery (evolution frozen).
interface Eval {
  wind: Compass;
  polarIndex: number;
  spec: number;
  gen: number;
}
const evals: Eval[] = BATTERY.map((w) => {
  const cond = { windDirection: w, targetQuadrant: TARGET };
  const spec = withSeed(SEED + 200, () => evaluateGenome(specialist.champion!, cond)).finisherRate;
  const gen = withSeed(SEED + 200, () => evaluateGenome(generalist.champion!, cond)).finisherRate;
  log(`  wind ${WIND_NAME[w].padEnd(2)}: spec ${pct(spec).padStart(4)}%  gen ${pct(gen).padStart(4)}%`);
  return { wind: w, polarIndex: relativeOctantSteps(Compass.NE, w), spec, gen };
});

const sorted = [...evals].sort((a, b) => a.polarIndex - b.polarIndex);
const specVals = evals.map((e) => e.spec);
const genVals = evals.map((e) => e.gen);
const specTrain = evals.find((e) => e.wind === TRAIN_WIND)!.spec;
const specMean = mean(specVals);
const specMin = Math.min(...specVals);
const genMean = mean(genVals);
const genMin = Math.min(...genVals);
const maxV = Math.max(...specVals, ...genVals);

const table = mdTable(
  ['Test wind (→ NE mark)', 'Point of sail', 'Specialist', 'Generalist'],
  sorted.map((e) => [
    WIND_NAME[e.wind] + (e.wind === TRAIN_WIND ? ' ◀ trained' : ''),
    `${e.polarIndex} · ${POINT_OF_SAIL[e.polarIndex]}`,
    `${pct(e.spec)}%`,
    `${pct(e.gen)}%`,
  ]),
);

const chart = sorted
  .map(
    (e) =>
      `${(WIND_NAME[e.wind] + (e.wind === TRAIN_WIND ? '*' : '')).padEnd(4)} ${POINT_OF_SAIL[e.polarIndex].slice(0, 12).padEnd(12)}\n  spec ${bar(e.spec, maxV)} ${pct(e.spec).padStart(4)}%\n  gen  ${bar(e.gen, maxV)} ${pct(e.gen).padStart(4)}%`,
  )
  .join('\n\n');

const md = `
# E6 · Specialist vs. Generalist

**Question.** If you evolve sailors on a single wind direction, they get very good at *that* wind. But have they learned to *sail*, or merely to execute one fixed manoeuvre? Train a second lineage on randomly shifting winds and the trade-off should appear: the specialist overfits its training condition; the generalist sacrifices peak performance for robustness across conditions it has never specifically optimised for. This is the bias–variance / overfitting story, told with boats.

**Hypothesis.** On a hold-out battery of all 8 wind directions, the **specialist will spike on its training wind and collapse off-distribution**, while the **generalist will be flatter and hold a much higher worst-case** (minimum across winds).

> Half supported, with a twist: the generalist does win the worst case, but the specialist is *not* brittle everywhere — it transfers *down* the difficulty ladder and beats the generalist on average. Generalisation turns out to be asymmetric.

**Method.** Target fixed at NE. Train a **specialist** on a single fixed wind (${WIND_NAME[TRAIN_WIND]}, close-hauled) and a **generalist** on \`windMode: random\` (a new wind each generation), both ${GENS} generations, seed ${SEED}, 300 boats. Then freeze evolution (clone the champion, mutation off) and measure finisher rate on every one of the 8 wind directions. Same evaluation seed for both champions so the comparison is apples-to-apples.

## Results

Trained-condition finisher rate: specialist on ${WIND_NAME[TRAIN_WIND]} = **${pct(specTrain)}%**.

${table}

### Performance across the wind battery (★ = specialist's training wind)

\`\`\`
${chart}
\`\`\`

|  | Mean across 8 winds | Worst-case (min) | On wind ${WIND_NAME[TRAIN_WIND]} |
| --- | --- | --- | --- |
| **Specialist** | ${pct(specMean)}% | ${pct(specMin)}% | ${pct(specTrain)}% |
| **Generalist** | ${pct(genMean)}% | ${pct(genMin)}% | ${pct(evals.find((e) => e.wind === TRAIN_WIND)!.gen)}% |

## Interpretation

The clean "generalist robust, specialist brittle" story is only half true. The data tell a sharper one: **generalisation is asymmetric, because points of sail are ordered by difficulty.**

- **The specialist is not brittle — it transfers *downward*.** Trained close-hauled (a moderately hard skill), it then handles every *easier* wind with ease, often better than the generalist: it scores ${pct(evals.find((e) => e.wind === Compass.SW)!.spec)}% on the run and ${pct(evals.find((e) => e.wind === Compass.NW)!.spec)}% on a beam reach. A boat that has mastered a hard point of sail trivially covers the easy ones. Its mean across all 8 winds (${pct(specMean)}%) actually *beats* the generalist's (${pct(genMean)}%), and it wins on ${evals.filter((e) => e.spec > e.gen).length} of 8 winds.
- **It has exactly one blind spot — the condition *harder* than training.** The specialist collapses to ${pct(specMin)}% only on the dead beat (NE), the one point of sail harder than the close-hauled wind it trained on and never encountered. Overfitting here is not "brittle everywhere"; it is "fine down to your training difficulty, catastrophic above it."
- **The generalist buys worst-case insurance — and pays for it everywhere.** Random training included the beat ~1/8 of the time, so the generalist's worst case is ${pct(genMin)}% (vs the specialist's ${pct(specMin)}%) — genuinely more robust on the killer condition. But spreading its limited training across eight winds (most of them easy) left it shallow on the hard ones: it manages only ${pct(evals.find((e) => e.wind === TRAIN_WIND)!.gen)}% even on close-hauled N, where the specialist gets ${pct(specTrain)}%. Jack of all winds, master of none.
- **Depth vs. coverage is the real trade-off.** Concentrated training masters a skill (and everything below it); diluted training avoids catastrophic blind spots but never gets deep. Variety is a regulariser that improves the *worst case*, not the average — here it actually *lowered* the mean. Which you want depends on whether you fear a bad average or a fatal outlier.

**Take-away.** A specialist is not fragile in general — it competently covers its training condition and everything easier, with a single catastrophic gap on conditions *harder* than it ever trained on. A generalist sacrifices depth (and average performance) everywhere to insure against that gap. Variety as a regulariser improves robustness to the worst case, but it is not free: it trades peak and mean for that insurance.

## Limitations

One seed per lineage; champion-clone evaluation reflects a single genome, not a population average — so the per-wind numbers carry real noise (which is why we lean on the structural pattern, not individual cells). The specialist's training wind (${WIND_NAME[TRAIN_WIND]}) is moderately hard; a specialist trained on an *easy* reach would have a far larger blind spot (everything harder than a reach). Target was fixed NE; a fuller test would vary the target quadrant too. Absolute rates are gate-ceiling-limited as elsewhere.

## Reproduce

\`\`\`bash
npx vite-node experiments/e6-specialist-generalist.ts
\`\`\`
`;

const path = writePaper('E6-specialist-generalist', md);
writeCsv(
  'E6',
  ['testWind', 'polarIndex', 'pointOfSail', 'specialistFinish', 'generalistFinish'],
  sorted.map((e) => [WIND_NAME[e.wind], e.polarIndex, POINT_OF_SAIL[e.polarIndex], e.spec.toFixed(4), e.gen.toFixed(4)]),
);
log(`\nPaper: ${path}`);
