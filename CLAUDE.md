# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt-Überblick

Sailing Dots ist eine interaktive Evolutionssimulation im Browser: Kleine Segelschiffe mit neuronalen Netz-Gehirnen lernen über Generationen, einen Ziel-Quadranten bei wechselndem Wind so schnell wie möglich zu erreichen. Da Segelboote nicht direkt gegen den Wind fahren können (No-Go-Zone ±45°), müssen sie Kreuzen (Zickzack-Kurse) evolvieren. Fork von Darwin's Arena, konzeptuell basierend auf [biosim4](https://github.com/davidrmiller/biosim4).

## Befehle

```bash
npm run dev       # Dev-Server starten (http://localhost:5173, Hot Reload)
npm run build     # TypeScript prüfen + Vite-Bundle erstellen (dist/)
npm run preview   # Produktions-Build lokal testen
npm test          # vitest (alle Tests)
npm test -- src/simulation/sailing.test.ts   # einzelne Testdatei
npm test -- -t "VMG"                          # einzelner Test nach Namensmuster

# Headless-Experimente (treiben die Engine ohne Worker/Browser via vite-node):
npx vite-node experiments/run-all.ts          # alle 7 Experimente, schreibt Papers nach docs/research/
npx vite-node experiments/e1-fitness-polar.ts # einzelnes Experiment
```

Kein Lint-Script konfiguriert.

## Architektur

### Web Worker / Haupt-Thread-Trennung

Die gesamte Simulationslogik läuft in einem Web Worker (`src/workers/simulation.worker.ts`), damit der UI-Thread reaktiv bleibt. Kommunikation ausschließlich per Message Passing:

- **Commands** (UI → Worker): `init`, `start`, `pause`, `reset`, `setSpeed`, `updateConfig`, `inspectAgent`
- **Messages** (Worker → UI): `state`, `generation`, `agentInfo`, `perf`, `ready`

Der React-Hook `src/hooks/useSimulation.ts` verwaltet die Worker-Instanz und den gesamten bidirektionalen Nachrichtenaustausch. Hier liegt der zentrale State der Anwendung.

### Simulationsengine (`src/simulation/`)

Der Kern-Loop in `simulator.ts`:

1. **Pro Schritt**: Jedes Boot liest 11 Sensoren (`sensors.ts`: Windwinkel & Zielpeilung relativ zum Heading als sin/cos-Paare, Distanz, Speed-EMA, Hindernis-Sonde u.a.) → Feed-Forward durch sein neuronales Netz (`neural-net.ts`) → steuert das Ruder (`actions.ts`: nur TURN_LEFT/TURN_RIGHT; Vortrieb erfolgt automatisch entlang des Headings mit Wahrscheinlichkeit aus der Polartabelle). `endOfSimStep` akkumuliert zudem pro Tick die VMG (velocity made good) zum Ziel und friert Finisher ein (kein Think/Move mehr, Grid-Zelle wird freigegeben, damit sie das Ziel-Gate nicht blockieren).
2. **Pro Generation**: Fitness-Bewertung der Regatta (`survival.ts`: früh ankommen = hoher Score; Nicht-Finisher bekommen einen Trostpreis-Gradienten aus Distanz-Fortschritt **und** VMG-Effizienz, damit Pinschen/Stallen bestraft wird) → Selektion → Reproduktion mit Mutation/Crossover (`spawn.ts`); danach wird Wind/Ziel für die nächste Generation gesetzt — VOR der Platzierung der neuen Boote

Wichtige Dateien:
- `sailing.ts` — Segelphysik: Polartabelle, Kompass↔Oktant-Mapping, `sailingEnv`-Singleton (aktueller Wind + Ziel-Quadrant), Quadranten-Helfer, `challengeBits`-Layout (Bit 16 = finished, untere 16 Bit = Ankunfts-Tick). Isoliert testbar (`sailing.test.ts`)
- `types.ts` — Zentrale Enums, Typen, Konstanten; `Indiv.heading` ist die Bootsausrichtung (nie CENTER)
- `params.ts` — Simulationsparameter inkl. `windMode` (fixed/rotate/random), `windDirection`, `windRotatePeriod`, `targetQuadrant` (-1 = zufällig)
- `genome.ts` + `genome-codec.ts` — Genom-Datenstruktur und URL-safe Serialisierung (Genome teilen)

Quadranten-Konvention: 0=SW, 1=SE, 2=NW, 3=NE in Grid-Koordinaten (y+ = Nord). Das Canvas spiegelt y beim Zeichnen (Grid-Nord = oben auf dem Bildschirm).

### React-Komponenten (`src/components/`)

`App.tsx` hält den Top-Level-State und koordiniert:
- `SplashScreen` → Preset-Auswahl beim Start (Regatta-Presets in `Presets.tsx`)
- `SimCanvas` — Canvas-Rendering (Boote als rotierte Dreiecke nach Heading, Windpfeil-Overlay, Zielquadrant-Markierung)
- `ControlPanel` — Steuer-Parameter inkl. Wind-Tab; hier liegt auch `SimConfig`/`DEFAULT_CONFIG`
- `Commentary`, `StatsGraph`, `GenomeGraph`, `AgentInspector`, `MatchSummary` — Visualisierung/Analyse

`?screensaver` in der URL aktiviert einen UI-losen Auto-Modus (Auto-Start, Preset-Rotation alle 100 Generationen, ruhiges Tempo); Konstanten oben in `App.tsx`.

### Determinismus & Headless-Experimente

Alle simulationsrelevante Zufälligkeit läuft durch `random.ts` (auch `genome.ts` importiert von dort — nur UI-Text in `commentary.ts` nutzt `Math.random` direkt). `random.ts` hält einen optionalen mulberry32-PRNG: `simulator.init()` ruft `seedRng(RNGSeed)` bzw. `clearRng()` je nach `params.deterministic`. Gleicher Seed + gleiche Params ⇒ byte-gleicher Lauf.

`experiments/harness.ts` treibt die Engine reproduzierbar **ohne** Worker/Browser: `withSeed()` (überschreibt `Math.random` für Vergleiche bei identischer Startpopulation), `runEvolution()`, `evaluateGenome()` (fixes Genom gegen Bedingungen bewerten), Kurs-Presets `COURSES` (Ziel fest NE, nur Wind variiert → durchläuft die Polartabelle). Die 7 Experimente und die abgeleiteten Verbesserungen sind in `docs/research/` dokumentiert.

### Performance-Besonderheiten

- ArrayBuffers werden per Transferable (Zero-Copy) zwischen Worker und Main Thread übertragen
- History wird auf 500 Einträge gecappt (`useSimulation.ts`)
- `stepsPerUpdate` wird auto-skaliert aus `stepsPerGeneration` um eine Ziel-FPS zu erreichen (`setSpeed` überschreibt das manuell — z. B. im Screensaver)

## Deployment

Vercel erkennt Vite automatisch. Push auf `main` → Auto-Deploy. Kein `vercel.json` nötig.

Das `Makefile` und `.github/workflows/main.yml` gehören zum Legacy-C++-Simulator und sind für die Web-App irrelevant.
