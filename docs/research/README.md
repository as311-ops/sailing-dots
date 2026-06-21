# Sailing Dots — Research Series

Seven small, self-contained experiments that use the Sailing Dots simulator as a laboratory for **simulation, evolution, and sailing**. Each one poses an original question, runs headless against the real engine (no UI), and is written up as a one-page paper with its data.

All experiments share a reusable harness (`experiments/harness.ts`): a seeded RNG for reproducibility, course presets that walk the boat's polar table by fixing the target (NE) and rotating only the wind, and helpers for stepping the simulation, evaluating frozen genomes, and rendering results.

```bash
npx vite-node experiments/run-all.ts          # run the whole series
npx vite-node experiments/e1-fitness-polar.ts  # or one at a time
```

> Methodological note: the simulator's RNG is seeded by overriding `Math.random` for the duration of each run, so every configuration starts from an identical population and only the variable under test changes. Raw data for each experiment is in [`data/`](./data).

---

## The papers

| # | Title | Question | One-line finding |
|---|---|---|---|
| **E1** | [The Evolutionary Polar Diagram](./E1-fitness-polar.md) | Does success follow raw speed or VMG-to-mark? | Two laws: speed sets *how fast* you finish (arrival time tracks VMG); the no-go zone sets *whether* you finish at all. |
| **E2** | [Tacking & the VMG-Optimal Angle](./E2-tacking-vmg.md) | Do boats discover the 45° close-hauled tack? | They find the right *sector* (upwind) but **over-pinch** into the no-go zone — the classic beginner's error. Strategy solved, tactics botched. |
| **E3** | [The Mutation Ridge](./E3-mutation-ridge.md) | Where is the optimal mutation rate? | An inverted-U peaking far **below** one-mutation-per-genome, because each gene is a high-impact whole synapse. |
| **E4** | [Sex or Clone?](./E4-sex-vs-clone.md) | Does recombination help hard sailing? | Cloning **wins** — crossover destroys epistatic genomes. But sex's deficit shrinks as the course gets harder. |
| **E5** | [How Big a Brain?](./E5-brain-size.md) | Minimum neural complexity to sail? | One neuron suffices for both courses; the beat is flat across brain sizes — it is **search-limited, not capacity-limited**. |
| **E6** | [Specialist vs. Generalist](./E6-specialist-generalist.md) | Does training variety buy robustness? | Generalisation is **asymmetric**: a specialist transfers *down* the difficulty ladder, failing only on conditions *harder* than training. |
| **E7** | [Founder Effect & Diversity Collapse](./E7-founder-effect.md) | What does population size govern? | Reproducibility: variance and diversity collapse with small populations. Plus a metric trap — finisher rate was secretly measuring crowding. |

---

## Synthesis — what the series teaches

Read together, the seven experiments keep returning to four ideas.

### 1. The no-go zone is the whole story

Sailing is trivial except for one forbidden wedge. Every "easy" course in this series is a near-reflex — point at the mark and go (E1, E5). Every "hard" course is the **dead beat**, and it is hard for exactly one reason: the rhumb line to the mark lies in the no-go zone, so the boat must evolve a deliberate zig-zag *away* from its target (E1). That single discontinuity is what turns sailing from a control reflex into a genuine search problem. Remove it and there is almost nothing to evolve.

### 2. The beat is a *search* problem, not a *representation* problem

Two independent experiments converge on this. E2 shows the evolved fleet finds the right strategic sector (close-hauled) but settles into a sub-optimal **over-pinching** local optimum, wasting half the race stalled head-to-wind. E5 shows that handing the controller more neurons does **nothing** for the beat — performance is flat from one to eight neurons. The bottleneck is not what the brain can *express* (one neuron already encodes the mediocre pinching policy) but what evolution can *find* on a rugged, weakly-gradiented landscape. More capacity is no substitute for a searchable problem.

### 3. High-impact genes make the genome brittle

Each gene encodes an entire synapse, so a single change can rewire behaviour. This one structural fact explains two separate results. E3 finds the optimal mutation rate is an order of magnitude *below* the textbook one-per-genome, because the genome cannot tolerate much perturbation. E4 finds that crossover — a *large* perturbation — is net **destructive**, so plain cloning beats sexual reproduction by letting a good genome sweep intact. Brittleness under mutation and brittleness under recombination are the same phenomenon seen twice.

### 4. Watch the metric

Finisher rate looks like a clean fitness measure and repeatedly is not. E1 separates it from arrival time (speed hides in *time*, not in *rate*, once the time budget is generous). E7 catches it red-handed: finisher rate *improved* as population shrank, not because small fleets sail better but because a fixed-width finish gate is less congested with fewer boats. Several experiments only became interpretable after choosing a metric that isolates the effect under study — a discipline that transfers to any simulation work.

### A note on being wrong

Five of the seven hypotheses were wrong, and that is the point. Evolution over-pinched instead of finding 45° (E2); cloning beat sex (E4); brains didn't need to grow (E5); specialists weren't broadly brittle (E6); small populations posted higher finisher rates (E7). Each surprise was more informative than the prediction would have been — the simulator is a better teacher than intuition, which is exactly why it is worth experimenting on.
