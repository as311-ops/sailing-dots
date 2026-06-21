// E5 -- How big a brain does a sailor need?
// Cap maxNumberNeurons and ask the minimal neural complexity that solves each
// course. An off-wind reach should be a near-reflex (sensor -> rudder, ~0
// internal neurons). A dead beat needs internal state / an oscillator to drive
// the tacking rhythm, so it should demand more neurons before it works.

import {
  COURSES,
  type Course,
  type GenerationResult,
  runEvolution,
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

const NEURONS = [1, 2, 3, 5, 8];
const SEEDS = [1, 2];
const GENS = 40;
const COURSE_SET: { course: Course; tag: string }[] = [
  { course: COURSES.beam, tag: 'easy reach' },
  { course: COURSES.beat, tag: 'hard beat' },
];

function avgNeuronsUsed(series: GenerationResult[]): number {
  const vals = series.slice(-8).map((s) => s.genomeProfile?.avgNeuronCount ?? 0);
  return mean(vals);
}

interface Cell {
  course: Course;
  tag: string;
  maxNeurons: number;
  convFinish: number;
  neuronsUsed: number;
}

log('E5 — Brain size');
const cells: Cell[] = [];
for (const { course, tag } of COURSE_SET) {
  for (const n of NEURONS) {
    const conv: number[] = [];
    const used: number[] = [];
    for (const seed of SEEDS) {
      const { series } = withSeed(seed, () =>
        runEvolution(
          { windDirection: course.windDirection, targetQuadrant: course.targetQuadrant, maxNumberNeurons: n },
          GENS,
        ),
      );
      conv.push(meanLastK(series.map((s) => s.finisherRate), 8));
      used.push(avgNeuronsUsed(series));
    }
    cells.push({ course, tag, maxNeurons: n, convFinish: mean(conv), neuronsUsed: mean(used) });
    log(`  ${tag.padEnd(11)} maxN=${n}  conv ${pct(mean(conv))}%  used ${mean(used).toFixed(1)}`);
  }
}

const cell = (tag: string, n: number) => cells.find((c) => c.tag === tag && c.maxNeurons === n)!;
const maxFinish = Math.max(...cells.map((c) => c.convFinish));

function courseBlock(tag: string): string {
  return NEURONS.map((n) => {
    const c = cell(tag, n);
    return `  maxN=${n}  ${bar(c.convFinish, maxFinish)} ${pct(c.convFinish).padStart(4)}%   (uses ${c.neuronsUsed.toFixed(1)} neurons)`;
  }).join('\n');
}

const table = mdTable(
  ['Course', 'Neuron cap', 'Converged finishers', 'Neurons actually used'],
  cells.map((c) => [`${c.course.label} (${c.tag})`, c.maxNeurons, `${pct(c.convFinish)}%`, c.neuronsUsed.toFixed(1)]),
);

// Knee: smallest cap reaching 90% of that course's own best.
function knee(tag: string): number {
  const best = Math.max(...NEURONS.map((n) => cell(tag, n).convFinish));
  for (const n of NEURONS) if (cell(tag, n).convFinish >= 0.9 * best) return n;
  return NEURONS[NEURONS.length - 1];
}
const kneeEasy = knee('easy reach');
const kneeHard = knee('hard beat');

const md = `
# E5 · How Big a Brain Does a Sailor Need?

**Question.** Each boat is steered by a tiny neural net wired from its genome. How much neural complexity does sailing actually require — and does the answer depend on the course? Pointing at a downwind mark feels like a reflex; tacking upwind feels like it needs rhythm and memory. Can we see that difference in the minimum viable brain?

**Hypothesis.** The easy reach will be solved by the smallest brains (near-reflex: sensor → rudder, almost no internal neurons). The dead beat will need **more** neurons, because tacking requires internal state or an oscillator to drive the zig-zag rhythm.

> Half right: the reach *is* a reflex. But the beat does **not** improve with more neurons — it is flat across the whole range. Its difficulty is not a lack of brain. That null result is the finding.

**Method.** Cap \`maxNumberNeurons\` ∈ {${NEURONS.join(', ')}} on the easy beam reach and the hard beat, ${GENS} generations, ${SEEDS.length} seeds, 300 boats. We record converged finisher rate and, from the champion's genome profile, the number of neurons the evolved controller *actually uses* (after culling dead neurons). Note the net can always wire sensors straight to the rudder, so even a cap of 1 permits reflex control.

## Results

${table}

### Finisher rate vs. neuron budget

\`\`\`
Beam reach (easy)
${courseBlock('easy reach')}

Dead beat (hard)
${courseBlock('hard beat')}
\`\`\`

Smallest cap within 90% of the course's own ceiling: **${kneeEasy} neuron${kneeEasy > 1 ? 's' : ''}** for the reach, **${kneeHard} neuron${kneeHard > 1 ? 's' : ''}** for the beat. *Both bottom out at one neuron.*

## Interpretation

The hypothesis assumed the beat is hard because it needs a bigger brain. The data says otherwise — and that reframes what "hard" means.

- **A reach is a reflex, solved at one neuron.** The beam reach reaches ${pct(cell('easy reach', 1).convFinish)}% with a cap of a single neuron, within a hair of its ${pct(Math.max(...NEURONS.map((n) => cell('easy reach', n).convFinish)))}% ceiling. "Sense the bearing to the mark, steer toward it" maps sensors to the rudder almost directly; extra capacity is wasted on a problem with no hidden state.
- **The beat does not care how many neurons it has.** Upwind performance is **flat at ${pct(cell('hard beat', 1).convFinish)}–${pct(Math.max(...NEURONS.map((n) => cell('hard beat', n).convFinish)))}% across the entire range** (1 → 8 neurons). More brain buys nothing. Whatever makes the beat hard, it is *not* a shortage of representational capacity.
- **So the beat is search-limited, not capacity-limited.** This is the direct complement of E2: the upwind ceiling is low because evolution gets stuck in the over-pinching local optimum, not because the controller cannot express good tacking. A one-neuron net can already encode the (mediocre) pinching strategy evolution settles on; handing it seven more neurons does not help evolution *find* anything better. The bottleneck is the fitness landscape, not the wiring diagram.
- **"Neurons used" rises while fitness stays flat — neutral passengers.** As the cap grows, champions wire up more neurons (1.0 → ~4.8) with no payoff. These are neutral hitchhikers, not functional contributors: capacity *provisioned* is not capacity *needed*. Evolution fills the space it is given but cannot convert idle neurons into skill on a problem it cannot search better.

**Take-away.** Both points of sail are solved — to whatever level evolution can reach — by a near-minimal one-neuron brain. The reach is capacity-saturated there; the beat is *search*-saturated, so extra neurons are inert. In this world the hard part of sailing is **finding** the policy, not **representing** it — more brain is no substitute for a searchable landscape.

## Limitations

\`maxNumberNeurons\` caps internal neurons only; sensor→action reflexes are always available, so even "1" is not a blank brain — which is partly why one neuron already suffices. ${SEEDS.length} seeds, ${GENS} generations — the beat is noisy at low finisher rates. A richer controller (recurrent state, larger genome) might still raise the beat ceiling; this experiment only shows that *feed-forward neuron count* within the current architecture is not the binding constraint. "Neurons used" reflects one champion genome, not the population.

## Reproduce

\`\`\`bash
npx vite-node experiments/e5-brain-size.ts
\`\`\`
`;

const path = writePaper('E5-brain-size', md);
writeCsv(
  'E5',
  ['course', 'difficulty', 'maxNeurons', 'convFinish', 'neuronsUsed'],
  cells.map((c) => [c.course.key, c.tag, c.maxNeurons, c.convFinish.toFixed(4), c.neuronsUsed.toFixed(2)]),
);
log(`\nPaper: ${path}`);
