# Sailing Dots

Evolution simulation in the browser. Watch neural networks learn to sail — including tacking against the wind, with no sailing knowledge programmed in.

**Live demo:** https://sailing-dots.vercel.app

## What is this?

Sailing Dots simulates a fleet of tiny sailboats, each with its own neural network as a brain. Every boat senses the wind angle and the bearing to a target zone, and steers its rudder based on its genes. At the end of each generation (one race), the boats that reached the target quadrant fastest pass on their genes — mutated and crossed over. Over many generations, sailing strategies emerge that nobody programmed.

The twist that makes it interesting: **sailboats cannot sail directly into the wind.** There is a no-go zone of ±45° around the wind direction, and boat speed depends on the angle between course and wind (a polar diagram). When the target lies upwind, heading straight for it fails — the optimal solution is tacking, a zigzag of turns. The neural network has to combine two inputs nonlinearly: "where is the target?" and "where does the wind come from?". And since the wind shifts over the generations, genomes that memorize compass directions collapse, while genomes that navigate relative to the wind keep winning.

Forked from [Darwin's Arena](https://github.com/as311-ops/darwin-dots), conceptually based on [biosim4](https://github.com/davidrmiller/biosim4) ("I programmed some creatures. They evolved.").

## Features

- **Sailing physics** — polar table with no-go zone (5% speed), close-hauled (50%), beam reach (100%), broad reach (90%), running (70%)
- **Wind regimes** — fixed, rotating (45° every N generations), or random per generation
- **Regatta challenge** — the fleet lines up behind a start line and races through a finish gate between two buoys; crossing early scores highest, near-misses earn a consolation gradient so early generations can bootstrap
- **Real-time visualization** — boats as heading-rotated triangles, wind rose overlay, highlighted target zone
- **Live commentary** — sports-reporter style commentary on the fleet's progress
- **Genome visualization** — network graph of evolved neural connections
- **Islands** — sandy obstacles reshuffled every race; boats read a clear-water sensor to evolve avoidance
- **Multi-leg courses** — round numbered marks in order before crossing the gate; the target sensors always point at the current objective
- **Pre-start phase** — the fleet jockeys behind the line until the gun; crossing early slashes the score, so start timing evolves
- **7 presets** — from First Regatta (downwind sprint) to Island Hopping, Triangle Course, and Match Race
- **Web Worker** — simulation runs in a background thread, UI stays responsive

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** as build tool
- **Tailwind CSS 4** for styling
- **Web Workers** for the simulation engine
- **Canvas API** for rendering
- **Vitest** for sailing physics and evolution integration tests

## Getting Started

```bash
npm install
npm run dev    # opens http://localhost:5173
npm test       # sailing physics + regatta integration tests
```

## Deployment

The app is a pure client-side SPA with no backend, deployed on Vercel. Every push to `main` deploys automatically.

## How does the simulation work?

1. **Initialization**: The fleet lines up in rows behind a start line in the quadrant opposite the finish gate — everyone races the same course. Each boat carries a random genome encoding a neural network (10 sensors, inner neurons, 2 actions).

2. **Simulation**: Each step, every boat reads its sensors — wind angle and target bearing relative to its own heading (as sin/cos pairs), target distance, speed — processes them through its neural network, and steers: turn 45° to port or starboard. The boat always sails forward along its heading, with a move probability taken from the polar table.

3. **Scoring**: When a boat first crosses the finish gate between the two buoys, its arrival tick is recorded — sailing past outside the buoys counts for nothing. Score = earlier is better. Boats that never finish get a small consolation score for getting close to the gate.

4. **Reproduction**: The best scores become parents. Their genomes are copied, crossed over, and mutated for the next race.

5. **Evolution**: Wind and target change according to the wind regime — set freshly before each new fleet spawns. Over hundreds of generations, the fleet learns to sail; with shifting winds, it learns to *navigate*.

## The races

| Preset | Wind | Course | What evolves |
|--------|------|--------|--------------|
| First Regatta | fixed N | sprint to SE (downwind) | basic steering toward the target |
| Upwind Battle | fixed N | sprint to NE (upwind) | tacking — visible zigzag courses |
| Shifting Winds | rotates 45°/30 gens | sprint, random target | wind-relative navigation |
| Storm Lottery | random per race | sprint, random target | true generalization |
| Island Hopping | rotates 45°/30 gens | sprint, 6 islands reshuffled each race | obstacle avoidance via the clear-water sensor |
| Triangle Course | fixed N | round mark 1 and 2, then the gate | multi-leg navigation with switching objectives |
| Match Race | random per race | sprint with 60-tick pre-start | start timing — close to the line, never over it |

## Origin

This project is a fork of [Darwin's Arena](https://github.com/as311-ops/darwin-dots), itself a complete rewrite of [biosim4](https://github.com/davidrmiller/biosim4) (C++ CLI) as an interactive browser application. The original C++ sources are archived under `src-cpp/`.

## License

MIT
