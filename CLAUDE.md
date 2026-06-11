# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt-Überblick

Sailing Dots ist eine interaktive Evolutionssimulation im Browser: Kleine Segelschiffe mit neuronalen Netz-Gehirnen lernen über Generationen, einen Ziel-Quadranten bei wechselndem Wind so schnell wie möglich zu erreichen. Da Segelboote nicht direkt gegen den Wind fahren können (No-Go-Zone ±45°), müssen sie Kreuzen (Zickzack-Kurse) evolvieren. Fork von Darwin's Arena, konzeptuell basierend auf [biosim4](https://github.com/davidrmiller/biosim4).

## Befehle

```bash
npm run dev       # Dev-Server starten (http://localhost:5173, Hot Reload)
npm run build     # TypeScript prüfen + Vite-Bundle erstellen (dist/)
npm run preview   # Produktions-Build lokal testen
npm test          # vitest (Segelphysik + Regatta-Integrationstest)
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

1. **Pro Schritt**: Jedes Boot liest 10 Sensoren (`sensors.ts`: Windwinkel & Zielpeilung relativ zum Heading als sin/cos-Paare, Distanz, Speed-EMA u.a.) → Feed-Forward durch sein neuronales Netz (`neural-net.ts`) → steuert das Ruder (`actions.ts`: nur TURN_LEFT/TURN_RIGHT; Vortrieb erfolgt automatisch entlang des Headings mit Wahrscheinlichkeit aus der Polartabelle)
2. **Pro Generation**: Fitness-Bewertung der Regatta (`survival.ts`: früh ankommen = hoher Score, Trostpreis-Gradient für Nicht-Finisher) → Selektion → Reproduktion mit Mutation/Crossover (`spawn.ts`); danach wird Wind/Ziel für die nächste Generation gesetzt — VOR der Platzierung der neuen Boote

Wichtige Dateien:
- `sailing.ts` — Segelphysik: Polartabelle, Kompass↔Oktant-Mapping, `sailingEnv`-Singleton (aktueller Wind + Ziel-Quadrant), Quadranten-Helfer, `challengeBits`-Layout (Bit 16 = finished, untere 16 Bit = Ankunfts-Tick). Isoliert testbar (`sailing.test.ts`)
- `types.ts` — Zentrale Enums, Typen, Konstanten; `Indiv.heading` ist die Bootsausrichtung (nie CENTER)
- `params.ts` — Simulationsparameter inkl. `windMode` (fixed/rotate/random), `windDirection`, `windRotatePeriod`, `targetQuadrant` (-1 = zufällig)
- `genome.ts` + `genome-codec.ts` — Genom-Datenstruktur und URL-safe Serialisierung (Genome teilen)

Quadranten-Konvention: 0=SW, 1=SE, 2=NW, 3=NE in Grid-Koordinaten (y+ = Nord). Das Canvas spiegelt y beim Zeichnen (Grid-Nord = oben auf dem Bildschirm).

### React-Komponenten (`src/components/`)

`App.tsx` hält den Top-Level-State und koordiniert:
- `SplashScreen` → Preset-Auswahl beim Start (4 Regatta-Presets in `Presets.tsx`)
- `SimCanvas` — Canvas-Rendering (Boote als rotierte Dreiecke nach Heading, Windpfeil-Overlay, Zielquadrant-Markierung)
- `ControlPanel` — Steuer-Parameter inkl. Wind-Tab; hier liegt auch `SimConfig`/`DEFAULT_CONFIG`
- `Commentary`, `StatsGraph`, `LineageTree`, `GenomeGraph` — Visualisierung/Analyse

### Performance-Besonderheiten

- ArrayBuffers werden per Transferable (Zero-Copy) zwischen Worker und Main Thread übertragen
- History wird auf 500 Einträge gecappt (`useSimulation.ts`)
- `stepsPerUpdate` wird auto-skaliert aus `stepsPerGeneration` um eine Ziel-FPS zu erreichen

## Deployment

Vercel erkennt Vite automatisch. Push auf `main` → Auto-Deploy. Kein `vercel.json` nötig.

Das `Makefile` und `.github/workflows/main.yml` gehören zum Legacy-C++-Simulator und sind für die Web-App irrelevant.
