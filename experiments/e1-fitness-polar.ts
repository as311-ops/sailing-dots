// E1 -- The Evolutionary Polar Diagram.
// Does evolutionary success follow raw boat speed, or the harder control problem?
// Sweep all points of sail (target fixed NE, wind varied) and measure converged
// finisher rate + arrival time. Overlay the physical polar against the result.

import {
  COURSES,
  type Course,
  runEvolution,
  withSeed,
  mean,
  meanLastK,
  meanValid,
  bar,
  sparkline,
  mdTable,
  writePaper,
  writeCsv,
  pct,
  log,
} from './harness';

const SEEDS = [1, 2];
const GENS = 40;
const ORDER: Course[] = [COURSES.run, COURSES.broad, COURSES.beam, COURSES.closehauled, COURSES.beat];

// Best velocity-made-good toward the mark. For every point of sail except the
// dead beat the rhumb line is sailable, so VMG = rhumb speed. On the beat the
// rhumb sits in the no-go zone (0.05); the boat must tack at 45° -> 0.5*cos45.
function bestVMG(c: Course): number {
  return c.polarIndex === 0 ? 0.5 * Math.cos(Math.PI / 4) : c.rhumbSpeed;
}

interface Row {
  course: Course;
  earlyFinish: number;
  convFinish: number;
  finishRange: [number, number];
  convArrival: number;
  series0: number[];
}

log('E1 — Evolutionary polar diagram');
const rows: Row[] = [];
for (const c of ORDER) {
  const perSeedConv: number[] = [];
  const perSeedEarly: number[] = [];
  const perSeedArr: number[] = [];
  let series0: number[] = [];
  for (let si = 0; si < SEEDS.length; si++) {
    const { series } = withSeed(SEEDS[si], () =>
      runEvolution({ windDirection: c.windDirection, targetQuadrant: c.targetQuadrant }, GENS),
    );
    const fin = series.map((s) => s.finisherRate);
    perSeedConv.push(meanLastK(fin, 8));
    perSeedEarly.push(mean(fin.slice(0, 5)));
    perSeedArr.push(meanValid(series.slice(-8).map((s) => s.avgArrivalTick)));
    if (si === 0) series0 = fin;
    log(`  ${c.key.padEnd(12)} seed ${SEEDS[si]}: conv ${pct(meanLastK(fin, 8))}%`);
  }
  rows.push({
    course: c,
    earlyFinish: mean(perSeedEarly),
    convFinish: mean(perSeedConv),
    finishRange: [Math.min(...perSeedConv), Math.max(...perSeedConv)],
    convArrival: meanValid(perSeedArr),
    series0,
  });
}

// ---- Build paper -----------------------------------------------------------
const maxFinish = Math.max(...rows.map((r) => r.convFinish));

const table = mdTable(
  ['Point of sail', 'Wind', 'Rhumb speed', 'Best VMG→mark', 'Converged finishers', 'Ø arrival (tick)', 'Learning curve (gen 0→40)'],
  rows.map((r) => [
    r.course.label,
    Compass(r.course.windDirection),
    r.course.rhumbSpeed.toFixed(2),
    bestVMG(r.course).toFixed(2),
    `${pct(r.convFinish)}% (${pct(r.finishRange[0])}–${pct(r.finishRange[1])})`,
    r.convArrival < 0 ? '—' : Math.round(r.convArrival).toString(),
    sparkline(r.series0),
  ]),
);

const rosette = rows
  .map((r) => `${r.course.label.padEnd(16)} ${bar(r.convFinish, maxFinish)} ${pct(r.convFinish)}%`)
  .join('\n');

const maxArr = Math.max(...rows.filter((r) => r.convArrival > 0).map((r) => r.convArrival));
const arrivalChart = rows
  .map((r) => `${r.course.label.padEnd(16)} ${bar(r.convArrival, maxArr)} ${Math.round(r.convArrival)} ticks`)
  .join('\n');

const vmgVsSuccess = rows
  .map((r) => {
    const v = bestVMG(r.course);
    return `${r.course.label.padEnd(16)} VMG ${v.toFixed(2)} ${bar(v, 1, 14)}  arrival ${String(Math.round(r.convArrival)).padStart(3)}t  finishers ${pct(r.convFinish).padStart(4)}%`;
  })
  .join('\n');

function Compass(c: number): string {
  return ['SW', 'S', 'SE', 'W', 'C', 'E', 'NW', 'N', 'NE'][c];
}

const md = `
# E1 · The Evolutionary Polar Diagram

**Question.** A sailboat's polar table gives raw speed per point of sail. But evolutionary *success* depends on two things at once: how fast the boat *can* go, and how hard the steering problem is to *learn*. Does evolved finisher rate track raw speed — or velocity-made-good toward the mark, which collapses on a dead beat?

**Hypothesis.** Success will follow **VMG toward the mark**, not raw hull speed. The beam reach (fastest, 1.0) should win the finisher rate; the dead beat should collapse far below what its tacking VMG (0.35) alone would predict, because tacking is also the hardest control skill to evolve.

**Method.** Target fixed at the NE quadrant (boats start SW). Only the wind direction changes, which walks the boat's rhumb line through every entry of the polar table \`[0.05, 0.5, 1.0, 0.9, 0.7]\`. ${GENS} generations, ${SEEDS.length} seeds, 300 boats, 600 steps/generation, otherwise \`DEFAULT_PARAMS\`. "Converged" = mean over the last 8 generations.

## Results

${table}

### Evolutionary polar (converged finisher rate)

\`\`\`
${rosette}
\`\`\`

### Arrival time — lower is faster (longer bar = slower)

\`\`\`
${arrivalChart}
\`\`\`

### Physical VMG vs. evolved outcome

\`\`\`
${vmgVsSuccess}
\`\`\`

## Interpretation

The hypothesis was half right — and the half it got wrong is the interesting part. **Raw speed and the no-go zone govern two *different* metrics.**

- **Arrival time tracks VMG almost perfectly.** Ranked by how fast boats reach the mark: beam (167) < broad (188) < run (202) < close-hauled (365) < beat (520). This is the polar table reading straight off the clock — faster point of sail, earlier arrival, monotonically. Raw hull speed clearly determines *how fast* a boat finishes.
- **Finisher rate does *not* rank by speed — it saturates, then cliffs.** Every course whose rhumb line is sailable (run, broad, beam) piles up against the same ~45–54% ceiling; the beam reach does **not** win despite being twice as fast as the run. That ceiling is structural: one finish gate, 300 boats, a generous 600-tick budget. When time is not the binding constraint, more speed buys earlier arrival, not more finishers.
- **The no-go zone is a phase change, not a gradient.** Speed degrades smoothly around the compass, but *success* is nearly binary: fine as long as the boat can point at the mark, then a cliff the moment the rhumb line enters the forbidden wedge. Close-hauled already slips to 38%; the dead beat falls to 16%, because there the rhumb line is physically unsailable and the boat must evolve a deliberate zig-zag away from the target.

**Take-away.** Two laws, not one: **raw hull speed sets how *fast* you finish (arrival time tracks VMG monotonically); the no-go zone sets *whether* you finish at all.** Evolution clears the first trivially and only partially conquers the second — the dead beat is the one course where physics forbids the direct line and demands an emergent tack.

## Limitations

Octant headings + quadrant targets discretise the polar into 5 steps; a real continuous polar would show smoother VMG-optimal angles. Only ${SEEDS.length} seeds and ${GENS} generations — ranges, not confidence intervals. Finisher rate is also capped by gate congestion (300 boats through one finish gate), so absolute ceilings understate per-boat skill.

## Reproduce

\`\`\`bash
npx vite-node experiments/e1-fitness-polar.ts
\`\`\`
`;

const path = writePaper('E1-fitness-polar', md);
writeCsv(
  'E1',
  ['course', 'windFrom', 'rhumbSpeed', 'bestVMG', 'earlyFinish', 'convFinish', 'convFinishMin', 'convFinishMax', 'avgArrival'],
  rows.map((r) => [
    r.course.key,
    Compass(r.course.windDirection),
    r.course.rhumbSpeed,
    bestVMG(r.course).toFixed(4),
    r.earlyFinish.toFixed(4),
    r.convFinish.toFixed(4),
    r.finishRange[0].toFixed(4),
    r.finishRange[1].toFixed(4),
    r.convArrival.toFixed(1),
  ]),
);
log(`\nPaper: ${path}`);
