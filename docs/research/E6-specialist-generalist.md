# E6 · Specialist vs. Generalist

**Question.** If you evolve sailors on a single wind direction, they get very good at *that* wind. But have they learned to *sail*, or merely to execute one fixed manoeuvre? Train a second lineage on randomly shifting winds and the trade-off should appear: the specialist overfits its training condition; the generalist sacrifices peak performance for robustness across conditions it has never specifically optimised for. This is the bias–variance / overfitting story, told with boats.

**Hypothesis.** On a hold-out battery of all 8 wind directions, the **specialist will spike on its training wind and collapse off-distribution**, while the **generalist will be flatter and hold a much higher worst-case** (minimum across winds).

> Half supported, with a twist: the generalist does win the worst case, but the specialist is *not* brittle everywhere — it transfers *down* the difficulty ladder and beats the generalist on average. Generalisation turns out to be asymmetric.

**Method.** Target fixed at NE. Train a **specialist** on a single fixed wind (N, close-hauled) and a **generalist** on `windMode: random` (a new wind each generation), both 60 generations, seed 1, 300 boats. Then freeze evolution (clone the champion, mutation off) and measure finisher rate on every one of the 8 wind directions. Same evaluation seed for both champions so the comparison is apples-to-apples.

## Results

Trained-condition finisher rate: specialist on N = **48.3%**.

| Test wind (→ NE mark) | Point of sail | Specialist | Generalist |
| --- | --- | --- | --- |
| NE | 0 · In irons (no-go) | 1.3% | 9.0% |
| E | 1 · Close-hauled | 41.0% | 38.0% |
| N ◀ trained | 1 · Close-hauled | 48.3% | 16.3% |
| SE | 2 · Beam reach | 42.3% | 40.3% |
| NW | 2 · Beam reach | 67.7% | 39.0% |
| S | 3 · Broad reach | 56.0% | 41.7% |
| W | 3 · Broad reach | 52.3% | 44.7% |
| SW | 4 · Run | 67.3% | 42.3% |

### Performance across the wind battery (★ = specialist's training wind)

```
NE   In irons (no
  spec ························  1.3%
  gen  ███·····················  9.0%

E    Close-hauled
  spec ███████████████········· 41.0%
  gen  █████████████··········· 38.0%

N*   Close-hauled
  spec █████████████████······· 48.3%
  gen  ██████·················· 16.3%

SE   Beam reach  
  spec ███████████████········· 42.3%
  gen  ██████████████·········· 40.3%

NW   Beam reach  
  spec ████████████████████████ 67.7%
  gen  ██████████████·········· 39.0%

S    Broad reach 
  spec ████████████████████···· 56.0%
  gen  ███████████████········· 41.7%

W    Broad reach 
  spec ███████████████████····· 52.3%
  gen  ████████████████········ 44.7%

SW   Run         
  spec ████████████████████████ 67.3%
  gen  ███████████████········· 42.3%
```

|  | Mean across 8 winds | Worst-case (min) | On wind N |
| --- | --- | --- | --- |
| **Specialist** | 47.0% | 1.3% | 48.3% |
| **Generalist** | 33.9% | 9.0% | 16.3% |

## Interpretation

The clean "generalist robust, specialist brittle" story is only half true. The data tell a sharper one: **generalisation is asymmetric, because points of sail are ordered by difficulty.**

- **The specialist is not brittle — it transfers *downward*.** Trained close-hauled (a moderately hard skill), it then handles every *easier* wind with ease, often better than the generalist: it scores 67.3% on the run and 67.7% on a beam reach. A boat that has mastered a hard point of sail trivially covers the easy ones. Its mean across all 8 winds (47.0%) actually *beats* the generalist's (33.9%), and it wins on 7 of 8 winds.
- **It has exactly one blind spot — the condition *harder* than training.** The specialist collapses to 1.3% only on the dead beat (NE), the one point of sail harder than the close-hauled wind it trained on and never encountered. Overfitting here is not "brittle everywhere"; it is "fine down to your training difficulty, catastrophic above it."
- **The generalist buys worst-case insurance — and pays for it everywhere.** Random training included the beat ~1/8 of the time, so the generalist's worst case is 9.0% (vs the specialist's 1.3%) — genuinely more robust on the killer condition. But spreading its limited training across eight winds (most of them easy) left it shallow on the hard ones: it manages only 16.3% even on close-hauled N, where the specialist gets 48.3%. Jack of all winds, master of none.
- **Depth vs. coverage is the real trade-off.** Concentrated training masters a skill (and everything below it); diluted training avoids catastrophic blind spots but never gets deep. Variety is a regulariser that improves the *worst case*, not the average — here it actually *lowered* the mean. Which you want depends on whether you fear a bad average or a fatal outlier.

**Take-away.** A specialist is not fragile in general — it competently covers its training condition and everything easier, with a single catastrophic gap on conditions *harder* than it ever trained on. A generalist sacrifices depth (and average performance) everywhere to insure against that gap. Variety as a regulariser improves robustness to the worst case, but it is not free: it trades peak and mean for that insurance.

## Limitations

One seed per lineage; champion-clone evaluation reflects a single genome, not a population average — so the per-wind numbers carry real noise (which is why we lean on the structural pattern, not individual cells). The specialist's training wind (N) is moderately hard; a specialist trained on an *easy* reach would have a far larger blind spot (everything harder than a reach). Target was fixed NE; a fuller test would vary the target quadrant too. Absolute rates are gate-ceiling-limited as elsewhere.

## Reproduce

```bash
npx vite-node experiments/e6-specialist-generalist.ts
```

