# E1 · The Evolutionary Polar Diagram

**Question.** A sailboat's polar table gives raw speed per point of sail. But evolutionary *success* depends on two things at once: how fast the boat *can* go, and how hard the steering problem is to *learn*. Does evolved finisher rate track raw speed — or velocity-made-good toward the mark, which collapses on a dead beat?

**Hypothesis.** Success will follow **VMG toward the mark**, not raw hull speed. The beam reach (fastest, 1.0) should win the finisher rate; the dead beat should collapse far below what its tacking VMG (0.35) alone would predict, because tacking is also the hardest control skill to evolve.

**Method.** Target fixed at the NE quadrant (boats start SW). Only the wind direction changes, which walks the boat's rhumb line through every entry of the polar table `[0.05, 0.5, 1.0, 0.9, 0.7]`. 40 generations, 2 seeds, 300 boats, 600 steps/generation, otherwise `DEFAULT_PARAMS`. "Converged" = mean over the last 8 generations.

## Results

| Point of sail | Wind | Rhumb speed | Best VMG→mark | Converged finishers | Ø arrival (tick) | Learning curve (gen 0→40) |
| --- | --- | --- | --- | --- | --- | --- |
| Run (downwind) | SW | 0.70 | 0.70 | 45.7% (42.8–48.5) | 202 | ▂▂▃▃▃▃▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▅▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄ |
| Broad reach | S | 0.90 | 0.90 | 53.8% (47.5–60.2) | 188 | ▂▂▂▂▃▃▃▃▃▄▄▄▄▄▄▄▄▄▅▄▄▄▄▄▄▄▄▄▄▄▄▅▄▄▄▅▄▄▄▄ |
| Beam reach | SE | 1.00 | 1.00 | 51.0% (48.3–53.8) | 167 | ▂▁▂▂▂▃▃▃▃▃▄▄▄▄▄▄▄▄▄▄▄▄▅▄▅▅▅▄▅▄▄▄▅▄▅▄▅▄▄▅ |
| Close-hauled | N | 0.50 | 0.50 | 38.4% (37.0–39.8) | 365 | ▁▁▁▂▂▂▂▃▃▃▃▃▃▃▃▃▃▃▃▄▄▄▄▄▄▃▄▄▄▃▄▄▃▄▃▄▃▄▄▄ |
| Beat (dead upwind) | NE | 0.05 | 0.35 | 16.1% (15.7–16.5) | 520 | ▁▁▁▁▁▁▁▁▁▁▁▁▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂ |

### Evolutionary polar (converged finisher rate)

```
Run (downwind)   ████████████████████···· 45.7%
Broad reach      ████████████████████████ 53.8%
Beam reach       ███████████████████████· 51.0%
Close-hauled     █████████████████······· 38.4%
Beat (dead upwind) ███████················· 16.1%
```

### Arrival time — lower is faster (longer bar = slower)

```
Run (downwind)   █████████··············· 202 ticks
Broad reach      █████████··············· 188 ticks
Beam reach       ████████················ 167 ticks
Close-hauled     █████████████████······· 365 ticks
Beat (dead upwind) ████████████████████████ 520 ticks
```

### Physical VMG vs. evolved outcome

```
Run (downwind)   VMG 0.70 ██████████····  arrival 202t  finishers 45.7%
Broad reach      VMG 0.90 █████████████·  arrival 188t  finishers 53.8%
Beam reach       VMG 1.00 ██████████████  arrival 167t  finishers 51.0%
Close-hauled     VMG 0.50 ███████·······  arrival 365t  finishers 38.4%
Beat (dead upwind) VMG 0.35 █████·········  arrival 520t  finishers 16.1%
```

## Interpretation

The hypothesis was half right — and the half it got wrong is the interesting part. **Raw speed and the no-go zone govern two *different* metrics.**

- **Arrival time tracks VMG almost perfectly.** Ranked by how fast boats reach the mark: beam (167) < broad (188) < run (202) < close-hauled (365) < beat (520). This is the polar table reading straight off the clock — faster point of sail, earlier arrival, monotonically. Raw hull speed clearly determines *how fast* a boat finishes.
- **Finisher rate does *not* rank by speed — it saturates, then cliffs.** Every course whose rhumb line is sailable (run, broad, beam) piles up against the same ~45–54% ceiling; the beam reach does **not** win despite being twice as fast as the run. That ceiling is structural: one finish gate, 300 boats, a generous 600-tick budget. When time is not the binding constraint, more speed buys earlier arrival, not more finishers.
- **The no-go zone is a phase change, not a gradient.** Speed degrades smoothly around the compass, but *success* is nearly binary: fine as long as the boat can point at the mark, then a cliff the moment the rhumb line enters the forbidden wedge. Close-hauled already slips to 38%; the dead beat falls to 16%, because there the rhumb line is physically unsailable and the boat must evolve a deliberate zig-zag away from the target.

**Take-away.** Two laws, not one: **raw hull speed sets how *fast* you finish (arrival time tracks VMG monotonically); the no-go zone sets *whether* you finish at all.** Evolution clears the first trivially and only partially conquers the second — the dead beat is the one course where physics forbids the direct line and demands an emergent tack.

## Limitations

Octant headings + quadrant targets discretise the polar into 5 steps; a real continuous polar would show smoother VMG-optimal angles. Only 2 seeds and 40 generations — ranges, not confidence intervals. Finisher rate is also capped by gate congestion (300 boats through one finish gate), so absolute ceilings understate per-boat skill.

## Reproduce

```bash
npx vite-node experiments/e1-fitness-polar.ts
```

