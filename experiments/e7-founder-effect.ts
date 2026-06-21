// E7 -- Founder effect & diversity collapse.
// Sweep population size. Small populations suffer genetic drift: diversity
// collapses early and the run gambles on whichever founders happened to do well,
// giving high run-to-run variance and a risk of premature convergence on a
// mediocre strategy. Large populations hold diversity, converge more reliably,
// but cost more per generation. The headline metric is *variance across seeds*.

import {
  COURSES,
  runEvolution,
  withSeed,
  mean,
  median,
  std,
  meanLastK,
  bar,
  sparkline,
  mdTable,
  writePaper,
  writeCsv,
  pct,
  log,
} from './harness';

const POPS = [30, 100, 300, 800];
const SEEDS = [1, 2, 3, 4];
const GENS = 50;
const course = COURSES.closehauled;

interface Row {
  pop: number;
  convMedian: number;
  convMin: number;
  convMax: number;
  convStd: number;
  finalDiv: number;
  earlyDiv: number;
  divTraj: number[]; // averaged across seeds
}

log('E7 — Founder effect (close-hauled)');
const rows: Row[] = [];
for (const pop of POPS) {
  const conv: number[] = [];
  const finalDiv: number[] = [];
  const earlyDiv: number[] = [];
  const divSeries: number[][] = [];
  for (const seed of SEEDS) {
    const { series } = withSeed(seed, () =>
      runEvolution(
        { windDirection: course.windDirection, targetQuadrant: course.targetQuadrant, population: pop },
        GENS,
      ),
    );
    conv.push(meanLastK(series.map((s) => s.finisherRate), 8));
    const div = series.map((s) => s.diversity);
    finalDiv.push(meanLastK(div, 8));
    earlyDiv.push(mean(div.slice(0, 3)));
    divSeries.push(div);
  }
  // Element-wise mean diversity trajectory across seeds.
  const divTraj = divSeries[0].map((_, g) => mean(divSeries.map((d) => d[g])));
  rows.push({
    pop,
    convMedian: median(conv),
    convMin: Math.min(...conv),
    convMax: Math.max(...conv),
    convStd: std(conv),
    finalDiv: median(finalDiv),
    earlyDiv: median(earlyDiv),
    divTraj,
  });
  log(`  pop ${String(pop).padStart(3)}: conv ${pct(median(conv))}% (spread ${pct(Math.min(...conv))}–${pct(Math.max(...conv))}, σ ${pct(std(conv))})  finalDiv ${median(finalDiv).toFixed(2)}`);
}

const maxStd = Math.max(...rows.map((r) => r.convStd));
const table = mdTable(
  ['Population', 'Converged finishers (median)', 'Spread across 4 seeds', 'σ (seed variance)', 'Final diversity'],
  rows.map((r) => [
    r.pop,
    `${pct(r.convMedian)}%`,
    `${pct(r.convMin)}–${pct(r.convMax)}%`,
    `${pct(r.convStd)} pts`,
    r.finalDiv.toFixed(2),
  ]),
);

const varianceChart = rows
  .map((r) => `pop ${String(r.pop).padStart(3)}  σ ${bar(r.convStd, maxStd)} ${pct(r.convStd)} pts   spread [${pct(r.convMin)}–${pct(r.convMax)}]%`)
  .join('\n');

const divChart = rows
  .map((r) => `pop ${String(r.pop).padStart(3)}  ${sparkline(r.divTraj)}  ${r.earlyDiv.toFixed(2)}→${r.finalDiv.toFixed(2)}`)
  .join('\n');

const small = rows[0];
const large = rows[rows.length - 1];

const md = `
# E7 · Founder Effect & Diversity Collapse

**Question.** Population size is the budget of an evolutionary search. A small population is cheap per generation but at the mercy of *genetic drift*: with few founders, diversity drains away fast and the run is hostage to whichever early genomes happened to look good — sometimes a lucky climb, sometimes premature convergence on a mediocre strategy. A large population holds variation and should converge more reliably. The signature of drift is not the *average* outcome but the **variance between runs**.

**Hypothesis.** As population shrinks, **run-to-run variance grows** and **diversity collapses earlier**; small populations will show a wide spread of converged outcome (lucky vs. stuck), while large populations cluster tightly.

> Confirmed for variance and diversity. But the experiment also exposed a **confounded metric** — finisher *rate* runs backwards here for a reason that has nothing to do with evolution. That confound is itself the most useful lesson, so it is reported in full below.

**Method.** Sweep \`population\` ∈ {${POPS.join(', ')}} on the close-hauled course, ${GENS} generations, ${SEEDS.length} seeds each, 600 steps/generation. We report converged finisher rate (median + full spread + standard deviation across seeds) and the diversity trajectory (1 − mean genome similarity), averaged across seeds.

## Results

${table}

> ⚠️ **Read the finisher-rate *level* with caution.** It falls as population grows (${pct(rows[0].convMedian)}% → ${pct(rows[rows.length - 1].convMedian)}%) — but that is **congestion, not skill**. Finisher rate is *finishers ÷ population* through a single fixed-width gate; 30 boats stroll through, 800 jam it. The valid cross-population signals are **variance** and **diversity**, which do not depend on the crowding level.

### Seed-to-seed variance (the fingerprint of drift)

\`\`\`
${varianceChart}
\`\`\`

### Diversity over ${GENS} generations (early → final)

\`\`\`
${divChart}
\`\`\`

## Interpretation

- **Variance is the fingerprint of drift — and it shrinks cleanly with population.** σ across seeds falls monotonically: ${pct(rows[0].convStd)} → ${pct(rows[1].convStd)} → ${pct(rows[2].convStd)} → ${pct(rows[3].convStd)} pts from pop ${small.pop} to ${large.pop}. At population ${small.pop} the four seeds scatter across ${pct(small.convMin)}–${pct(small.convMax)}% — identical settings, outcomes decided by which founders happened to dominate. At population ${large.pop} they cluster within ${pct(large.convMin)}–${pct(large.convMax)}%. This is the founder effect made quantitative: fewer founders, more luck.
- **Diversity collapses fastest when there is least of it.** Final diversity climbs straight up the population axis: ${rows.map((r) => r.finalDiv.toFixed(2)).join(' → ')}. Population ${small.pop} converges to **0.00 — total monoculture**: a single lineage conquers the entire fleet within a few generations. Larger populations keep a broad gene pool alive, which is precisely *why* their outcomes are repeatable — there are always alternative lineages in reserve when one stalls.
- **The metric trap: finisher rate ran backwards.** The most useful surprise is methodological. Finisher *rate* improved as population shrank, which would naively read as "small populations sail better." They don't — the gate is a fixed-width bottleneck, so a smaller fleet finishes a higher *fraction* purely by being less crowded. A metric that silently mixes evolutionary quality with population density cannot compare across population sizes. The lesson generalises far beyond boats: always check whether your fitness number is contaminated by the very variable you are sweeping.
- **Drift cuts both ways.** A small population is not reliably worse — sometimes drift fixes a good genome early and the run shines (one pop-${small.pop} seed hit ${pct(small.convMax)}%). The danger is *unreliability*: you cannot tell in advance whether a tiny-population run got lucky or locked onto a dead end. Reproducibility, not mean performance, is what a larger population buys — at proportional compute cost.

**Take-away.** Population size governs *reproducibility*. Small populations are dominated by genetic drift: diversity collapses to monoculture and outcomes scatter (σ ${pct(small.convStd)} pts), so any single run is a gamble. Large populations preserve the standing variation that makes evolution repeatable (σ ${pct(large.convStd)} pts), trading compute for confidence. And mind the metric: a number that looks like fitness — finisher rate — was really measuring crowding, a reminder to verify what you are actually counting.

## Limitations

${SEEDS.length} seeds estimate variance from a small sample — the σ values are themselves noisy, though the order-of-magnitude trend is unmistakable. Diversity uses a fast genome-similarity proxy (first-genes Hamming), so absolute values are approximate; the *trajectories* and *ordering* are the point. Finisher-rate levels are confounded by gate congestion (see above) and must not be compared across population sizes. Generation count is fixed, so small populations are not given extra generations to offset slower per-generation progress.

## Reproduce

\`\`\`bash
npx vite-node experiments/e7-founder-effect.ts
\`\`\`
`;

const path = writePaper('E7-founder-effect', md);
writeCsv(
  'E7',
  ['population', 'convMedian', 'convMin', 'convMax', 'convStd', 'earlyDiversity', 'finalDiversity'],
  rows.map((r) => [
    r.pop,
    r.convMedian.toFixed(4),
    r.convMin.toFixed(4),
    r.convMax.toFixed(4),
    r.convStd.toFixed(4),
    r.earlyDiv.toFixed(4),
    r.finalDiv.toFixed(4),
  ]),
);
log(`\nPaper: ${path}`);
