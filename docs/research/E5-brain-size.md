# E5 · How Big a Brain Does a Sailor Need?

**Question.** Each boat is steered by a tiny neural net wired from its genome. How much neural complexity does sailing actually require — and does the answer depend on the course? Pointing at a downwind mark feels like a reflex; tacking upwind feels like it needs rhythm and memory. Can we see that difference in the minimum viable brain?

**Hypothesis.** The easy reach will be solved by the smallest brains (near-reflex: sensor → rudder, almost no internal neurons). The dead beat will need **more** neurons, because tacking requires internal state or an oscillator to drive the zig-zag rhythm.

> Half right: the reach *is* a reflex. But the beat does **not** improve with more neurons — it is flat across the whole range. Its difficulty is not a lack of brain. That null result is the finding.

**Method.** Cap `maxNumberNeurons` ∈ {1, 2, 3, 5, 8} on the easy beam reach and the hard beat, 40 generations, 2 seeds, 300 boats. We record converged finisher rate and, from the champion's genome profile, the number of neurons the evolved controller *actually uses* (after culling dead neurons). Note the net can always wire sensors straight to the rudder, so even a cap of 1 permits reflex control.

## Results

| Course | Neuron cap | Converged finishers | Neurons actually used |
| --- | --- | --- | --- |
| Beam reach (easy reach) | 1 | 49.5% | 1.0 |
| Beam reach (easy reach) | 2 | 52.7% | 1.9 |
| Beam reach (easy reach) | 3 | 51.2% | 2.6 |
| Beam reach (easy reach) | 5 | 51.0% | 3.9 |
| Beam reach (easy reach) | 8 | 51.4% | 4.8 |
| Beat (dead upwind) (hard beat) | 1 | 16.0% | 1.0 |
| Beat (dead upwind) (hard beat) | 2 | 16.4% | 1.8 |
| Beat (dead upwind) (hard beat) | 3 | 17.0% | 2.9 |
| Beat (dead upwind) (hard beat) | 5 | 16.1% | 3.7 |
| Beat (dead upwind) (hard beat) | 8 | 17.0% | 4.8 |

### Finisher rate vs. neuron budget

```
Beam reach (easy)
  maxN=1  ███████████████████████· 49.5%   (uses 1.0 neurons)
  maxN=2  ████████████████████████ 52.7%   (uses 1.9 neurons)
  maxN=3  ███████████████████████· 51.2%   (uses 2.6 neurons)
  maxN=5  ███████████████████████· 51.0%   (uses 3.9 neurons)
  maxN=8  ███████████████████████· 51.4%   (uses 4.8 neurons)

Dead beat (hard)
  maxN=1  ███████················· 16.0%   (uses 1.0 neurons)
  maxN=2  ███████················· 16.4%   (uses 1.8 neurons)
  maxN=3  ████████················ 17.0%   (uses 2.9 neurons)
  maxN=5  ███████················· 16.1%   (uses 3.7 neurons)
  maxN=8  ████████················ 17.0%   (uses 4.8 neurons)
```

Smallest cap within 90% of the course's own ceiling: **1 neuron** for the reach, **1 neuron** for the beat. *Both bottom out at one neuron.*

## Interpretation

The hypothesis assumed the beat is hard because it needs a bigger brain. The data says otherwise — and that reframes what "hard" means.

- **A reach is a reflex, solved at one neuron.** The beam reach reaches 49.5% with a cap of a single neuron, within a hair of its 52.7% ceiling. "Sense the bearing to the mark, steer toward it" maps sensors to the rudder almost directly; extra capacity is wasted on a problem with no hidden state.
- **The beat does not care how many neurons it has.** Upwind performance is **flat at 16.0–17.0% across the entire range** (1 → 8 neurons). More brain buys nothing. Whatever makes the beat hard, it is *not* a shortage of representational capacity.
- **So the beat is search-limited, not capacity-limited.** This is the direct complement of E2: the upwind ceiling is low because evolution gets stuck in the over-pinching local optimum, not because the controller cannot express good tacking. A one-neuron net can already encode the (mediocre) pinching strategy evolution settles on; handing it seven more neurons does not help evolution *find* anything better. The bottleneck is the fitness landscape, not the wiring diagram.
- **"Neurons used" rises while fitness stays flat — neutral passengers.** As the cap grows, champions wire up more neurons (1.0 → ~4.8) with no payoff. These are neutral hitchhikers, not functional contributors: capacity *provisioned* is not capacity *needed*. Evolution fills the space it is given but cannot convert idle neurons into skill on a problem it cannot search better.

**Take-away.** Both points of sail are solved — to whatever level evolution can reach — by a near-minimal one-neuron brain. The reach is capacity-saturated there; the beat is *search*-saturated, so extra neurons are inert. In this world the hard part of sailing is **finding** the policy, not **representing** it — more brain is no substitute for a searchable landscape.

## Limitations

`maxNumberNeurons` caps internal neurons only; sensor→action reflexes are always available, so even "1" is not a blank brain — which is partly why one neuron already suffices. 2 seeds, 40 generations — the beat is noisy at low finisher rates. A richer controller (recurrent state, larger genome) might still raise the beat ceiling; this experiment only shows that *feed-forward neuron count* within the current architecture is not the binding constraint. "Neurons used" reflects one champion genome, not the population.

## Reproduce

```bash
npx vite-node experiments/e5-brain-size.ts
```

