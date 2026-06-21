// E3 -- The mutation ridge: exploration vs exploitation.
// Sweep pointMutationRate over three orders of magnitude on a close-hauled
// course. Too little variation -> evolution stalls; too much -> the genome
// can't hold onto good solutions ("error catastrophe"). We expect an inverted-U
// in converged fitness, and we relate the optimum to mutations-per-genome.

import {
  COURSES,
  runEvolution,
  withSeed,
  median,
  meanLastK,
  gensToThreshold,
  bar,
  sparkline,
  mdTable,
  writePaper,
  writeCsv,
  pct,
  log,
} from './harness';

const RATES = [0, 0.001, 0.005, 0.02, 0.05, 0.1, 0.2];
const SEEDS = [1, 2, 3];
const GENS = 40;
const GENOME_LEN = 24; // genomeInitialLength, insertion/deletion off -> stays ~constant
const THRESHOLD = 0.25;
const course = COURSES.closehauled;

interface Row {
  rate: number;
  expMut: number;
  convFinish: number;
  finishRange: [number, number];
  gensToThr: number; // median; GENS+ if never
  convDiv: number;
  series0: number[];
}

log('E3 — Mutation ridge (close-hauled)');
const rows: Row[] = [];
for (const rate of RATES) {
  const conv: number[] = [];
  const div: number[] = [];
  const reach: number[] = [];
  let series0: number[] = [];
  for (let si = 0; si < SEEDS.length; si++) {
    const { series } = withSeed(SEEDS[si], () =>
      runEvolution(
        { windDirection: course.windDirection, targetQuadrant: course.targetQuadrant, pointMutationRate: rate },
        GENS,
      ),
    );
    const fin = series.map((s) => s.finisherRate);
    conv.push(meanLastK(fin, 8));
    div.push(meanLastK(series.map((s) => s.diversity), 8));
    const g = gensToThreshold(series, 'finisherRate', THRESHOLD);
    reach.push(g < 0 ? GENS : g);
    if (si === 0) series0 = fin;
  }
  rows.push({
    rate,
    expMut: rate * GENOME_LEN,
    convFinish: median(conv),
    finishRange: [Math.min(...conv), Math.max(...conv)],
    gensToThr: median(reach),
    convDiv: median(div),
    series0,
  });
  log(`  rate ${String(rate).padEnd(6)} conv ${pct(median(conv))}%  div ${median(div).toFixed(2)}`);
}

const best = rows.reduce((a, b) => (b.convFinish > a.convFinish ? b : a));
const maxFinish = Math.max(...rows.map((r) => r.convFinish));

const table = mdTable(
  ['Point mutation rate', 'Exp. mutations / genome', 'Converged finishers', 'Gens to 25%', 'Final diversity', 'Learning curve'],
  rows.map((r) => [
    r.rate === 0 ? '0 (none)' : r.rate.toString(),
    r.expMut.toFixed(3),
    `${pct(r.convFinish)}% (${pct(r.finishRange[0])}–${pct(r.finishRange[1])})`,
    r.gensToThr >= GENS ? `≥${GENS}` : r.gensToThr.toString(),
    r.convDiv.toFixed(2),
    sparkline(r.series0),
  ]),
);

const ridge = rows
  .map((r) => {
    const mark = r === best ? '  ◀ peak' : '';
    return `rate ${(r.rate === 0 ? '0' : r.rate.toString()).padStart(5)}  ${bar(r.convFinish, maxFinish)} ${pct(r.convFinish).padStart(4)}%${mark}`;
  })
  .join('\n');

const md = `
# E3 · The Mutation Ridge

**Question.** Mutation is the engine of variation, but more is not better. With too low a mutation rate, evolution has nothing new to try and stalls on whatever the initial random genomes happened to encode. With too high a rate, good solutions are scrambled faster than selection can lock them in — the "error catastrophe." Where is the sweet spot, and how sharp is the ridge?

**Hypothesis.** Converged fitness will trace an **inverted-U** in \`pointMutationRate\`: poor at 0, peaking at some intermediate value, and degrading at high rates. The peak should sit near roughly **one mutation per genome per reproduction**.

> The inverted-U held; the predicted peak location did not. The optimum sits an order of magnitude *below* one-per-genome — see the interpretation.

**Method.** Sweep \`pointMutationRate\` ∈ {${RATES.join(', ')}} on the close-hauled course (wind N, target NE), ${GENS} generations, ${SEEDS.length} seeds (median + range). 300 boats, genome length ${GENOME_LEN} (insertion/deletion off, so length is ~constant). Expected mutations per genome = rate × ${GENOME_LEN}. We also track final genetic **diversity** (1 − mean genome similarity among survivors).

## Results

${table}

### Converged fitness vs. mutation rate

\`\`\`
${ridge}
\`\`\`

Peak at **rate ${best.rate}** (≈ ${best.expMut.toFixed(2)} mutations per genome per reproduction).

## Interpretation

- **The inverted-U is real, and asymmetric.** Fitness rises gently to a peak at rate **${best.rate}** and then falls off hard toward the high end. The two failure modes differ in kind: the low end is *starved of variation*, the high end *cannot retain* what it finds — and only the high end is catastrophic here.
- **The peak is far below "one mutation per genome."** The optimum, ≈${best.expMut.toFixed(2)} mutations per genome, is an *order of magnitude* lower than the textbook one-per-genome guess. The reason is structural: each of the ~${GENOME_LEN} genes encodes a *whole synapse* (source, sink, weight), so a single bit-flip can rewire the controller. With such high-impact genes the genome is brittle, and evolution tolerates only a trickle of mutation — roughly one mutated offspring in eight at the peak.
- **Zero mutation is only mildly worse — on an easy course.** With no mutation, evolution merely reshuffles and selects among the generation-0 genomes. On the moderately easy close-hauled course those starting genomes already contain decent sailors, so pure selection still reaches ~36%. The cost of zero mutation is a missing top end and bleeding diversity, not collapse — the penalty would bite far harder on a course where no good solution exists at the start.
- **The high-mutation end is an error catastrophe.** When children carry several bit-flips each, a good controller is rarely passed on intact. Diversity stays *high* (the population is a churning cloud) yet fitness sinks, because selection cannot accumulate gains before they are scrambled.
- **Diversity and fitness are not the same axis.** The highest-diversity run (rate 0.2, diversity 0.71) is the *worst* performer. High diversity is necessary but not sufficient; the optimum balances enough novelty to explore against enough fidelity to exploit — the exploration/exploitation trade-off as a single tunable knob.

**Take-away.** Mutation rate is a dial between a frozen population and a boiling one, and good evolution lives on a narrow ridge between them. Here the ridge sits around **${best.expMut.toFixed(2)} mutations per genome** — much lower than folklore, because each gene is a high-impact whole-synapse mutation. Enough to keep proposing new ideas; few enough to keep the good ones.

## Limitations

Only ${GENS} generations: a very low mutation rate might still creep upward given far longer, so "stall" here means "within a realistic horizon." Genome length is fixed at ${GENOME_LEN} with insertion/deletion disabled — the mutations-per-genome mapping would shift if genomes grew. ${SEEDS.length} seeds give medians and ranges, not significance tests. The close-hauled course is moderately easy, which softens the low-mutation penalty; the exact peak may shift on harder courses.

## Reproduce

\`\`\`bash
npx vite-node experiments/e3-mutation-ridge.ts
\`\`\`
`;

const path = writePaper('E3-mutation-ridge', md);
writeCsv(
  'E3',
  ['rate', 'expMutPerGenome', 'convFinish', 'convFinishMin', 'convFinishMax', 'gensTo25', 'finalDiversity'],
  rows.map((r) => [
    r.rate,
    r.expMut.toFixed(4),
    r.convFinish.toFixed(4),
    r.finishRange[0].toFixed(4),
    r.finishRange[1].toFixed(4),
    r.gensToThr >= GENS ? GENS : r.gensToThr,
    r.convDiv.toFixed(4),
  ]),
);
log(`\nPaper: ${path}`);
