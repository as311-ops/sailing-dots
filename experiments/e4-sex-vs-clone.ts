// E4 -- Sex or clone? Does recombination help with hard sailing?
// Crossover (sexualReproduction=true) can assemble building blocks from two
// parents; cloning (false) relies on mutation alone. If upwind sailing is a
// "compound" skill (hold a tack + trigger a tack), recombination should help
// more on the hard beat than on an easy beam reach.

import {
  COURSES,
  type Course,
  runEvolution,
  withSeed,
  median,
  meanLastK,
  mean,
  bar,
  sparkline,
  mdTable,
  writePaper,
  writeCsv,
  pct,
  log,
} from './harness';

const SEEDS = [1, 2, 3];
const GENS = 40;
const COURSE_SET: { course: Course; tag: string }[] = [
  { course: COURSES.beam, tag: 'easy' },
  { course: COURSES.beat, tag: 'hard' },
];

interface Cell {
  course: Course;
  tag: string;
  sexual: boolean;
  convFinish: number;
  finishRange: [number, number];
  convDiv: number;
  series0: number[];
}

function run(course: Course, sexual: boolean): Cell {
  const conv: number[] = [];
  const div: number[] = [];
  let series0: number[] = [];
  for (let si = 0; si < SEEDS.length; si++) {
    const { series } = withSeed(SEEDS[si], () =>
      runEvolution(
        {
          windDirection: course.windDirection,
          targetQuadrant: course.targetQuadrant,
          sexualReproduction: sexual,
        },
        GENS,
      ),
    );
    const fin = series.map((s) => s.finisherRate);
    conv.push(meanLastK(fin, 8));
    div.push(meanLastK(series.map((s) => s.diversity), 8));
    if (si === 0) series0 = fin;
  }
  return {
    course,
    tag: COURSE_SET.find((c) => c.course === course)!.tag,
    sexual,
    convFinish: median(conv),
    finishRange: [Math.min(...conv), Math.max(...conv)],
    convDiv: median(div),
    series0,
  };
}

log('E4 — Sex vs. clone');
const cells: Cell[] = [];
for (const { course } of COURSE_SET) {
  for (const sexual of [true, false]) {
    const cell = run(course, sexual);
    cells.push(cell);
    log(`  ${course.key.padEnd(6)} ${sexual ? 'sexual' : 'clone '}  conv ${pct(cell.convFinish)}%  div ${cell.convDiv.toFixed(2)}`);
  }
}

const get = (tag: string, sexual: boolean) => cells.find((c) => c.tag === tag && c.sexual === sexual)!;
const maxFinish = Math.max(...cells.map((c) => c.convFinish));

const table = mdTable(
  ['Course', 'Reproduction', 'Converged finishers', 'Final diversity', 'Learning curve'],
  cells.map((c) => [
    `${c.course.label} (${c.tag})`,
    c.sexual ? 'Sexual (crossover)' : 'Asexual (clone)',
    `${pct(c.convFinish)}% (${pct(c.finishRange[0])}–${pct(c.finishRange[1])})`,
    c.convDiv.toFixed(2),
    sparkline(c.series0),
  ]),
);

function advantage(tag: string): number {
  return get(tag, true).convFinish - get(tag, false).convFinish;
}
const easyAdv = advantage('easy');
const hardAdv = advantage('hard');

const advChart = COURSE_SET.map(({ tag, course }) => {
  const s = get(tag, true).convFinish;
  const a = get(tag, false).convFinish;
  return `${course.label} (${tag})\n  sexual ${bar(s, maxFinish)} ${pct(s).padStart(4)}%\n  clone  ${bar(a, maxFinish)} ${pct(a).padStart(4)}%  Δ ${(advantage(tag) * 100 >= 0 ? '+' : '')}${pct(advantage(tag))} pts`;
}).join('\n\n');

const md = `
# E4 · Sex or Clone? Recombination and Hard Sailing

**Question.** Sexual reproduction recombines two parent genomes; asexual reproduction clones one and relies on mutation alone for novelty. Recombination's classic advantage is *assembling building blocks* — taking a good piece from each parent. Upwind sailing looks like a compound skill (hold a close-hauled tack **and** trigger a tack at the right moment), while an off-wind reach is nearly a single reflex (point at the mark). Does crossover help more when the skill is compound?

**Hypothesis.** The crossover advantage will be **larger on the hard beat than on the easy beam reach**: recombination should pay off where the solution has separable parts to recombine.

> Refuted, and informatively so: cloning *beat* crossover on **both** courses — and the surprise is largest exactly where the skill is simplest. The difficulty effect is real but runs the other way.

**Method.** 2 reproduction modes (\`sexualReproduction\` true/false) × 2 courses (beam reach = easy, dead beat = hard) × ${SEEDS.length} seeds × ${GENS} generations, 300 boats. "Converged" = mean finisher rate over the last 8 generations (median across seeds). Everything else from \`DEFAULT_PARAMS\`.

## Results

${table}

### Crossover advantage by course difficulty

\`\`\`
${advChart}
\`\`\`

Advantage of sex (sexual − clone): **${pct(easyAdv)} pts** on the easy reach, **${pct(hardAdv)} pts** on the hard beat. Both negative — cloning wins — but the penalty for sex shrinks ${Math.round((Math.abs(easyAdv) / Math.max(0.001, Math.abs(hardAdv))))}× as difficulty rises.

## Interpretation

The hypothesis assumed crossover *assembles* good solutions. Here it mostly *destroys* them — and that reframes everything.

- **Cloning dominates, most dramatically where the task is easiest.** On the beam reach, cloning reaches **${pct(get('easy', false).convFinish)}%** against crossover's **${pct(get('easy', true).convFinish)}%** — a ${pct(-easyAdv)}-point rout. The clone population collapses to **diversity ${get('easy', false).convDiv.toFixed(2)}**: one near-optimal reacher genome sweeps the entire fleet and everyone inherits it intact. Crossover never lets that happen — it keeps shuffling genes (diversity ${get('easy', true).convDiv.toFixed(2)}) and so keeps *breaking* the very genome selection is trying to fix.
- **Why recombination is destructive here.** Each gene encodes a whole synapse (source, sink, weight), so the controller is highly *epistatic* — its behaviour depends on specific gene combinations, not independent parts. The crossover operator (copy the longer parent, overlay a random slice of the shorter, trim to average length) splices two different working genomes into a hybrid that usually works worse than either. This is the same brittleness E3 found for mutation: high-impact genes punish large perturbations, and crossover is a large perturbation.
- **Premature convergence isn't always bad.** Clone-on-reach hits zero diversity — textbook premature convergence — yet wins, because the genome it converged *to* is essentially optimal. Monoculture is only a problem when the monoculture is mediocre. (E7 explores the flip side, where small populations converge early to something *worse*.)
- **The difficulty effect is real, but inverted.** Sex's deficit shrinks from ${pct(easyAdv)} pts on the reach to just ${pct(hardAdv)} pts on the beat. On the rugged upwind landscape there *is* something to explore, so crossover's relentless diversity (it never lets the fleet freeze) partly pays for its disruption — and cloning can no longer ride a single perfect genome to victory (its diversity stays ${get('hard', false).convDiv.toFixed(2)}, not zero). The harder the course, the less cloning's "find one winner and copy it" strategy is worth.

**Take-away.** Recombination is not a free speed-up — with epistatic genes and a coarse crossover operator it is a *net destroyer* of good solutions, and plain cloning wins by letting a winner sweep. But its value is contingent on difficulty: the harder and more rugged the course, the more crossover's forced exploration earns back, and the gap closes.

## Limitations

The crossover operator is deliberately coarse (slice-overlay + trim), which inflates its destructiveness; a structure-aware operator could recover real building-block benefits. ${SEEDS.length} seeds give medians and ranges. Clone runs reaching zero diversity are at the mercy of *which* genome happens to sweep — different seeds could converge to different genomes. Two courses only; a difficulty gradient would test the (inverted) trend properly.

## Reproduce

\`\`\`bash
npx vite-node experiments/e4-sex-vs-clone.ts
\`\`\`
`;

const path = writePaper('E4-sex-vs-clone', md);
writeCsv(
  'E4',
  ['course', 'difficulty', 'reproduction', 'convFinish', 'convFinishMin', 'convFinishMax', 'finalDiversity'],
  cells.map((c) => [
    c.course.key,
    c.tag,
    c.sexual ? 'sexual' : 'clone',
    c.convFinish.toFixed(4),
    c.finishRange[0].toFixed(4),
    c.finishRange[1].toFixed(4),
    c.convDiv.toFixed(4),
  ]),
);
log(`\nPaper: ${path}`);
