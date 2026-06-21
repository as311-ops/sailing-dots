# E3 · The Mutation Ridge

**Question.** Mutation is the engine of variation, but more is not better. With too low a mutation rate, evolution has nothing new to try and stalls on whatever the initial random genomes happened to encode. With too high a rate, good solutions are scrambled faster than selection can lock them in — the "error catastrophe." Where is the sweet spot, and how sharp is the ridge?

**Hypothesis.** Converged fitness will trace an **inverted-U** in `pointMutationRate`: poor at 0, peaking at some intermediate value, and degrading at high rates. The peak should sit near roughly **one mutation per genome per reproduction**.

> The inverted-U held; the predicted peak location did not. The optimum sits an order of magnitude *below* one-per-genome — see the interpretation.

**Method.** Sweep `pointMutationRate` ∈ {0, 0.001, 0.005, 0.02, 0.05, 0.1, 0.2} on the close-hauled course (wind N, target NE), 40 generations, 3 seeds (median + range). 300 boats, genome length 24 (insertion/deletion off, so length is ~constant). Expected mutations per genome = rate × 24. We also track final genetic **diversity** (1 − mean genome similarity among survivors).

## Results

| Point mutation rate | Exp. mutations / genome | Converged finishers | Gens to 25% | Final diversity | Learning curve |
| --- | --- | --- | --- | --- | --- |
| 0 (none) | 0.000 | 35.7% (35.7–37.7) | 9 | 0.58 | ▁▁▁▂▂▂▂▂▃▃▃▃▃▃▃▄▃▄▄▄▄▄▃▃▄▃▄▄▄▄▄▄▄▄▄▃▄▄▄▄ |
| 0.001 | 0.024 | 37.0% (37.0–39.8) | 9 | 0.66 | ▁▁▁▂▂▂▂▃▃▃▃▃▃▃▃▃▃▃▃▄▄▄▄▄▄▃▄▄▄▃▄▄▃▄▃▄▃▄▄▄ |
| 0.005 | 0.120 | 40.9% (36.8–43.4) | 11 | 0.66 | ▁▁▁▂▂▂▂▂▂▂▃▃▃▃▃▃▃▃▃▃▄▄▄▄▃▄▃▄▄▄▄▄▄▃▃▄▄▄▄▃ |
| 0.02 | 0.480 | 34.6% (33.7–39.0) | 9 | 0.65 | ▁▁▁▁▂▂▂▂▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▄▃▄▃▃▃▃▄▃▃▃ |
| 0.05 | 1.200 | 35.7% (33.5–36.1) | 13 | 0.59 | ▁▁▁▁▂▂▂▂▃▃▃▃▃▄▃▃▃▃▃▄▃▃▃▃▃▄▃▃▃▃▃▃▃▃▃▃▃▃▃▃ |
| 0.1 | 2.400 | 30.7% (30.2–32.0) | 12 | 0.61 | ▁▁▁▁▁▁▂▂▂▂▂▂▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃ |
| 0.2 | 4.800 | 25.0% (23.1–27.0) | 23 | 0.71 | ▁▁▁▁▁▁▁▁▁▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▃▃▃▃▃▃▂▃▃▃▃▂▃▃▃ |

### Converged fitness vs. mutation rate

```
rate     0  █████████████████████··· 35.7%
rate 0.001  ██████████████████████·· 37.0%
rate 0.005  ████████████████████████ 40.9%  ◀ peak
rate  0.02  ████████████████████···· 34.6%
rate  0.05  █████████████████████··· 35.7%
rate   0.1  ██████████████████······ 30.7%
rate   0.2  ███████████████········· 25.0%
```

Peak at **rate 0.005** (≈ 0.12 mutations per genome per reproduction).

## Interpretation

- **The inverted-U is real, and asymmetric.** Fitness rises gently to a peak at rate **0.005** and then falls off hard toward the high end. The two failure modes differ in kind: the low end is *starved of variation*, the high end *cannot retain* what it finds — and only the high end is catastrophic here.
- **The peak is far below "one mutation per genome."** The optimum, ≈0.12 mutations per genome, is an *order of magnitude* lower than the textbook one-per-genome guess. The reason is structural: each of the ~24 genes encodes a *whole synapse* (source, sink, weight), so a single bit-flip can rewire the controller. With such high-impact genes the genome is brittle, and evolution tolerates only a trickle of mutation — roughly one mutated offspring in eight at the peak.
- **Zero mutation is only mildly worse — on an easy course.** With no mutation, evolution merely reshuffles and selects among the generation-0 genomes. On the moderately easy close-hauled course those starting genomes already contain decent sailors, so pure selection still reaches ~36%. The cost of zero mutation is a missing top end and bleeding diversity, not collapse — the penalty would bite far harder on a course where no good solution exists at the start.
- **The high-mutation end is an error catastrophe.** When children carry several bit-flips each, a good controller is rarely passed on intact. Diversity stays *high* (the population is a churning cloud) yet fitness sinks, because selection cannot accumulate gains before they are scrambled.
- **Diversity and fitness are not the same axis.** The highest-diversity run (rate 0.2, diversity 0.71) is the *worst* performer. High diversity is necessary but not sufficient; the optimum balances enough novelty to explore against enough fidelity to exploit — the exploration/exploitation trade-off as a single tunable knob.

**Take-away.** Mutation rate is a dial between a frozen population and a boiling one, and good evolution lives on a narrow ridge between them. Here the ridge sits around **0.12 mutations per genome** — much lower than folklore, because each gene is a high-impact whole-synapse mutation. Enough to keep proposing new ideas; few enough to keep the good ones.

## Limitations

Only 40 generations: a very low mutation rate might still creep upward given far longer, so "stall" here means "within a realistic horizon." Genome length is fixed at 24 with insertion/deletion disabled — the mutations-per-genome mapping would shift if genomes grew. 3 seeds give medians and ranges, not significance tests. The close-hauled course is moderately easy, which softens the low-mutation penalty; the exact peak may shift on harder courses.

## Reproduce

```bash
npx vite-node experiments/e3-mutation-ridge.ts
```

