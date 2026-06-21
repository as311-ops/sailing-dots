# E4 · Sex or Clone? Recombination and Hard Sailing

**Question.** Sexual reproduction recombines two parent genomes; asexual reproduction clones one and relies on mutation alone for novelty. Recombination's classic advantage is *assembling building blocks* — taking a good piece from each parent. Upwind sailing looks like a compound skill (hold a close-hauled tack **and** trigger a tack at the right moment), while an off-wind reach is nearly a single reflex (point at the mark). Does crossover help more when the skill is compound?

**Hypothesis.** The crossover advantage will be **larger on the hard beat than on the easy beam reach**: recombination should pay off where the solution has separable parts to recombine.

> Refuted, and informatively so: cloning *beat* crossover on **both** courses — and the surprise is largest exactly where the skill is simplest. The difficulty effect is real but runs the other way.

**Method.** 2 reproduction modes (`sexualReproduction` true/false) × 2 courses (beam reach = easy, dead beat = hard) × 3 seeds × 40 generations, 300 boats. "Converged" = mean finisher rate over the last 8 generations (median across seeds). Everything else from `DEFAULT_PARAMS`.

## Results

| Course | Reproduction | Converged finishers | Final diversity | Learning curve |
| --- | --- | --- | --- | --- |
| Beam reach (easy) | Sexual (crossover) | 53.8% (48.3–53.9) | 0.64 | ▂▁▂▂▂▃▃▃▃▃▄▄▄▄▄▄▄▄▄▄▄▄▅▄▅▅▅▄▅▄▄▄▅▄▅▄▅▄▄▅ |
| Beam reach (easy) | Asexual (clone) | 89.1% (65.7–93.2) | 0.00 | ▂▂▃▅▆▇▇▇▇▇▇▇██▇▇▇▇█▇██▇▇█▇█▇█▇▇████▇██▇▇ |
| Beat (dead upwind) (hard) | Sexual (crossover) | 16.5% (15.7–17.8) | 0.54 | ▁▁▁▁▁▁▁▁▁▁▁▁▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂ |
| Beat (dead upwind) (hard) | Asexual (clone) | 22.5% (20.3–23.6) | 0.41 | ▁▁▁▁▁▂▂▂▂▂▂▂▂▂▃▂▂▂▃▃▃▃▃▃▃▃▂▂▃▃▃▃▂▂▃▂▃▂▃▃ |

### Crossover advantage by course difficulty

```
Beam reach (easy)
  sexual ███████████████········· 53.8%
  clone  ████████████████████████ 89.1%  Δ -35.3 pts

Beat (dead upwind) (hard)
  sexual ████···················· 16.5%
  clone  ██████·················· 22.5%  Δ -6.0 pts
```

Advantage of sex (sexual − clone): **-35.3 pts** on the easy reach, **-6.0 pts** on the hard beat. Both negative — cloning wins — but the penalty for sex shrinks 6× as difficulty rises.

## Interpretation

The hypothesis assumed crossover *assembles* good solutions. Here it mostly *destroys* them — and that reframes everything.

- **Cloning dominates, most dramatically where the task is easiest.** On the beam reach, cloning reaches **89.1%** against crossover's **53.8%** — a 35.3-point rout. The clone population collapses to **diversity 0.00**: one near-optimal reacher genome sweeps the entire fleet and everyone inherits it intact. Crossover never lets that happen — it keeps shuffling genes (diversity 0.64) and so keeps *breaking* the very genome selection is trying to fix.
- **Why recombination is destructive here.** Each gene encodes a whole synapse (source, sink, weight), so the controller is highly *epistatic* — its behaviour depends on specific gene combinations, not independent parts. The crossover operator (copy the longer parent, overlay a random slice of the shorter, trim to average length) splices two different working genomes into a hybrid that usually works worse than either. This is the same brittleness E3 found for mutation: high-impact genes punish large perturbations, and crossover is a large perturbation.
- **Premature convergence isn't always bad.** Clone-on-reach hits zero diversity — textbook premature convergence — yet wins, because the genome it converged *to* is essentially optimal. Monoculture is only a problem when the monoculture is mediocre. (E7 explores the flip side, where small populations converge early to something *worse*.)
- **The difficulty effect is real, but inverted.** Sex's deficit shrinks from -35.3 pts on the reach to just -6.0 pts on the beat. On the rugged upwind landscape there *is* something to explore, so crossover's relentless diversity (it never lets the fleet freeze) partly pays for its disruption — and cloning can no longer ride a single perfect genome to victory (its diversity stays 0.41, not zero). The harder the course, the less cloning's "find one winner and copy it" strategy is worth.

**Take-away.** Recombination is not a free speed-up — with epistatic genes and a coarse crossover operator it is a *net destroyer* of good solutions, and plain cloning wins by letting a winner sweep. But its value is contingent on difficulty: the harder and more rugged the course, the more crossover's forced exploration earns back, and the gap closes.

## Limitations

The crossover operator is deliberately coarse (slice-overlay + trim), which inflates its destructiveness; a structure-aware operator could recover real building-block benefits. 3 seeds give medians and ranges. Clone runs reaching zero diversity are at the mercy of *which* genome happens to sweep — different seeds could converge to different genomes. Two courses only; a difficulty gradient would test the (inverted) trend properly.

## Reproduce

```bash
npx vite-node experiments/e4-sex-vs-clone.ts
```

