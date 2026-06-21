# E7 · Founder Effect & Diversity Collapse

**Question.** Population size is the budget of an evolutionary search. A small population is cheap per generation but at the mercy of *genetic drift*: with few founders, diversity drains away fast and the run is hostage to whichever early genomes happened to look good — sometimes a lucky climb, sometimes premature convergence on a mediocre strategy. A large population holds variation and should converge more reliably. The signature of drift is not the *average* outcome but the **variance between runs**.

**Hypothesis.** As population shrinks, **run-to-run variance grows** and **diversity collapses earlier**; small populations will show a wide spread of converged outcome (lucky vs. stuck), while large populations cluster tightly.

> Confirmed for variance and diversity. But the experiment also exposed a **confounded metric** — finisher *rate* runs backwards here for a reason that has nothing to do with evolution. That confound is itself the most useful lesson, so it is reported in full below.

**Method.** Sweep `population` ∈ {30, 100, 300, 800} on the close-hauled course, 50 generations, 4 seeds each, 600 steps/generation. We report converged finisher rate (median + full spread + standard deviation across seeds) and the diversity trajectory (1 − mean genome similarity), averaged across seeds.

## Results

| Population | Converged finishers (median) | Spread across 4 seeds | σ (seed variance) | Final diversity |
| --- | --- | --- | --- | --- |
| 30 | 98.3% | 81.3–100.0% | 7.7 pts | 0.00 |
| 100 | 58.7% | 47.8–69.1% | 7.6 pts | 0.20 |
| 300 | 41.5% | 36.6–42.0% | 2.2 pts | 0.58 |
| 800 | 18.6% | 17.5–20.3% | 1.1 pts | 0.71 |

> ⚠️ **Read the finisher-rate *level* with caution.** It falls as population grows (98.3% → 18.6%) — but that is **congestion, not skill**. Finisher rate is *finishers ÷ population* through a single fixed-width gate; 30 boats stroll through, 800 jam it. The valid cross-population signals are **variance** and **diversity**, which do not depend on the crowding level.

### Seed-to-seed variance (the fingerprint of drift)

```
pop  30  σ ████████████████████████ 7.7 pts   spread [81.3–100.0]%
pop 100  σ ████████████████████████ 7.6 pts   spread [47.8–69.1]%
pop 300  σ ███████················· 2.2 pts   spread [36.6–42.0]%
pop 800  σ ███····················· 1.1 pts   spread [17.5–20.3]%
```

### Diversity over 50 generations (early → final)

```
pop  30  █▇▇▇▆▆▅▅▅▅▅▄▃▃▂▂▂▂▂▂▂▂▂▁▂▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  0.93→0.00
pop 100  ██▇▇▇▇▆▆▆▆▆▆▅▅▅▅▅▅▄▅▄▄▄▄▄▄▄▃▃▃▃▃▃▃▃▂▃▃▂▂▂▂▂▂▂▂▂▂▂▂  0.95→0.20
pop 300  ███▇█▇▇▇▇▇▇▇▇▇▇▆▆▇▆▇▆▆▆▆▆▆▆▆▆▆▆▆▅▆▆▅▅▅▅▅▅▅▅▅▅▅▅▅▅▅  0.95→0.58
pop 800  ████▇█▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▆▆▇▇▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆  0.96→0.71
```

## Interpretation

- **Variance is the fingerprint of drift — and it shrinks cleanly with population.** σ across seeds falls monotonically: 7.7 → 7.6 → 2.2 → 1.1 pts from pop 30 to 800. At population 30 the four seeds scatter across 81.3–100.0% — identical settings, outcomes decided by which founders happened to dominate. At population 800 they cluster within 17.5–20.3%. This is the founder effect made quantitative: fewer founders, more luck.
- **Diversity collapses fastest when there is least of it.** Final diversity climbs straight up the population axis: 0.00 → 0.20 → 0.58 → 0.71. Population 30 converges to **0.00 — total monoculture**: a single lineage conquers the entire fleet within a few generations. Larger populations keep a broad gene pool alive, which is precisely *why* their outcomes are repeatable — there are always alternative lineages in reserve when one stalls.
- **The metric trap: finisher rate ran backwards.** The most useful surprise is methodological. Finisher *rate* improved as population shrank, which would naively read as "small populations sail better." They don't — the gate is a fixed-width bottleneck, so a smaller fleet finishes a higher *fraction* purely by being less crowded. A metric that silently mixes evolutionary quality with population density cannot compare across population sizes. The lesson generalises far beyond boats: always check whether your fitness number is contaminated by the very variable you are sweeping.
- **Drift cuts both ways.** A small population is not reliably worse — sometimes drift fixes a good genome early and the run shines (one pop-30 seed hit 100.0%). The danger is *unreliability*: you cannot tell in advance whether a tiny-population run got lucky or locked onto a dead end. Reproducibility, not mean performance, is what a larger population buys — at proportional compute cost.

**Take-away.** Population size governs *reproducibility*. Small populations are dominated by genetic drift: diversity collapses to monoculture and outcomes scatter (σ 7.7 pts), so any single run is a gamble. Large populations preserve the standing variation that makes evolution repeatable (σ 1.1 pts), trading compute for confidence. And mind the metric: a number that looks like fitness — finisher rate — was really measuring crowding, a reminder to verify what you are actually counting.

## Limitations

4 seeds estimate variance from a small sample — the σ values are themselves noisy, though the order-of-magnitude trend is unmistakable. Diversity uses a fast genome-similarity proxy (first-genes Hamming), so absolute values are approximate; the *trajectories* and *ordering* are the point. Finisher-rate levels are confounded by gate congestion (see above) and must not be compared across population sizes. Generation count is fixed, so small populations are not given extra generations to offset slower per-generation progress.

## Reproduce

```bash
npx vite-node experiments/e7-founder-effect.ts
```

