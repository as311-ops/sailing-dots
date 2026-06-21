# E2 · Tacking and the VMG-Optimal Angle

**Question.** On a dead beat the target lies straight upwind, where the boat cannot sail (no-go zone, speed 0.05). The only way to make ground to windward is to sail close-hauled at 45° (polar index 1, speed 0.5) and alternate tacks. Does evolution actually *discover* this — concentrating the fleet at 45° and producing genuine port/starboard tacking — or does it stall in irons, or fall off to a fast-but-useless beam reach (90°, full speed but **zero** velocity made good to windward)?

**Hypothesis.** The evolved fleet will pile up at polar index 1 (close-hauled), spend little time in irons, and show a clearly higher tack count than a naive fleet — emergent zig-zag matching real sailing theory.

**Method.** Evolve 60 generations on the beat (wind NE, target NE), seed 1. Then sample headings *every tick* for two fleets racing the same beat: a **naive** gen-0 random fleet, and an **evolved** fleet of champion clones (mutation frozen). For each boat-tick we record the polar index of its sailing angle; while close-hauled we track which tack it is on and count switches. Boats that have finished are excluded (we want active racing behaviour).

## Results

Learning curve (finisher rate, gen 0→60): `▁▁▁▁▁▁▁▁▁▁▁▁▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂`  →  17.2% converged.

### Where the fleet points (fraction of racing time per polar index)

| Polar index · point of sail | Naive fleet (gen 0) | Evolved fleet |
| --- | --- | --- |
| 0 · In irons (no-go) | ███····················· 12.7% | ████████████············ 51.6% |
| 1 · Close-hauled | ██████·················· 24.7% | ███████████············· 46.1% |
| 2 · Beam reach | ██████·················· 24.9% | ························ 1.7% |
| 3 · Broad reach | ██████·················· 25.3% | ························ 0.5% |
| 4 · Run | ███····················· 12.3% | ························ 0.2% |

### Summary

| Metric | Naive (gen 0) | Evolved |
| --- | --- | --- |
| Time close-hauled (idx 1, the productive angle) | 24.7% | 46.1% |
| Time in irons (idx 0, no-go, stalled) | 12.7% | 51.6% |
| Time at beam reach (idx 2, zero VMG to windward) | 24.9% | 1.7% |
| Tacks per boat per race (port↔starboard) | 14.23 | 7.29 |
| Finisher rate | 0.0% | 9.3% |

## Interpretation

The hypothesis was wrong in the most informative way possible. Evolution solves the **strategic** half of upwind sailing and fails the **tactical** half — and the failure mode is the exact mistake every beginner sailor makes.

- **It commits to the upwind sector.** The naive fleet smears its time evenly across all five points of sail (~12–25% each — it has no idea which way to go). The evolved fleet collapses **98% of its racing time into just indices 0 and 1** — the close-hauled-and-higher sector — and abandons the beam reach, broad reach, and run almost entirely (each ≤1.7%). It has learned the single most important strategic fact about a beat: *go upwind, never fall off to a reach that sails away from the mark.*
- **But it over-pinches — the classic beginner's error.** Instead of parking at the VMG-optimal 45° (index 1), the evolved fleet spends **more** time stalled head-to-wind (index 0, 51.6%) than actually sailing close-hauled (index 1, 46.1%). It points *too high*. In octant steering the productive 45° bin and the dead 0° bin are adjacent, so the heuristic "point as high as you can" constantly overshoots into the no-go zone, where the boat stalls. Evolution found the right *direction* but a sub-optimal *angle* — a local optimum that wastes half the race in irons and explains the brutally low finisher rate.
- **It does avoid the beam-reach trap.** A beam reach (index 2) is the fastest point of sail (speed 1.0) but makes **zero** progress to windward — pure sideways motion. A naive speed-maximiser would get stuck there; the evolved fleet drops it to 1.7%. So the error is asymmetric: evolution overshoots *toward* the wind (pinching), never *away* from it.
- **Tacking is real, but the count is a poor measure of it.** The naive fleet logs *more* close-hauled side-switches (14.2 vs 7.3) — but those are random churn: a boat steering at random brushes both tacks constantly. The evolved boats hold a tack and commit, so each of their fewer switches is a deliberate tack. Switch-counting conflates noise with skill; the distribution collapse is the cleaner evidence that genuine upwind sailing emerged.

**Take-away.** With nothing but a "finish sooner" signal, evolution reliably discovers *which way* to sail a beat — collapse onto the close-hauled sector, never reach away — but stalls at the finer skill of *how high* to point, over-pinching into the no-go zone exactly like a novice. It solves the strategy and botches the tactics, which is precisely why the dead beat stays the hardest course in the whole simulation.

## Limitations

Headings are octants, so the productive 45° angle and the dead 0° angle are *adjacent* bins — this almost certainly amplifies the over-pinching, since there is no intermediate angle to settle on. A continuous polar would let us see whether real pinching/footing trade-offs persist or smooth out. Single seed for the behavioural sample. The evolved fleet are near-identical champion clones, which sharpens the histogram; a diverse population would be broader. Tack counts include only index-1 switches, so wide tacks passing briefly through other angles are under-counted.

## Reproduce

```bash
npx vite-node experiments/e2-tacking-vmg.ts
```

