# Sailing Dots — Design-Spec

**Datum:** 2026-06-11
**Status:** Entwurf zur Review
**Basis:** Fork von Darwin's Arena (darwin-dots), diese Arbeitskopie wird die eigenständige App „Sailing Dots"

## 1. Ziel und Idee

Sailing Dots ist eine Evolutionssimulation, in der kleine Segelschiffe mit neuronalen Netz-Gehirnen lernen, einen Ziel-Quadranten so schnell wie möglich zu erreichen — bei Wind, der über die Zeit aus unterschiedlichen Richtungen weht.

Der evolutionäre Kern: Segelschiffe können nicht direkt gegen den Wind fahren (No-Go-Zone ±45°), und ihre Geschwindigkeit hängt vom Winkel zwischen Kurs und Wind ab (Polardiagramm). Liegt das Ziel in Luv, scheitert die gierige Strategie „direkt aufs Ziel zu" — die optimale Lösung ist Kreuzen (Zickzack aus Wenden). Das Netz muss Windwinkel und Zielpeilung nichtlinear kombinieren. Dreht der Wind über die Generationen, überleben nur Genome, die *relativ zum Wind* navigieren statt absolute Richtungen hartzukodieren.

**Nicht-Ziele (spätere Ausbaustufen, nicht Teil dieser Spec):** Inseln/Hindernisse, Strömungsfelder, Mehrbein-Kurse mit Bojen, Trägheit/Impuls, Kollisionen zwischen Booten.

## 2. Abgrenzung zum Fork

Die App bleibt architektonisch Darwin's Arena (Web Worker + React, Genom → NN → Sensoren/Aktionen, Challenge-basierte Fitness). Geändert wird:

**Ersetzt / neu:**
- Sensorik: neuer, kleiner Sensorsatz (Wind + Ziel statt Population/Signale/Barrieren)
- Aktionen: nur noch Drehen (TURN_LEFT/TURN_RIGHT); Vortrieb kommt automatisch vom Wind
- Bewegungsmodell: Heading + Polartabelle statt frei wählbarer Bewegungsrichtung
- Eine einzige Challenge: `CHALLENGE_REGATTA` (ersetzt die 23 bestehenden)
- Rendering: Boote als rotierte Dreiecke, Windpfeil-Overlay, Zielquadrant-Markierung
- Branding: Name, Titel, SplashScreen-Texte, Presets

**Entfernt:**
- Kill-Mechanik (`killEnable`, `KILL_FORWARD`, Hunt-or-Hide)
- Signal-/Pheromon-Layer (Sensoren, `EMIT_SIGNAL0`, Rendering-Heatmap)
- Die 23 Alt-Challenges samt Beschreibungen und Challenge-Overlays
- Barrieren (Code darf liegen bleiben, wird aber deaktiviert: `barrierType = none`; Wiederverwendung später für Inseln)

**Unverändert:**
- Genom, Mutation/Crossover, Selektion (`genome.ts`, `spawn.ts`, `neural-net.ts`)
- Genome-Sharing via URL (`genome-codec.ts`)
- Worker-Protokoll, `useSimulation.ts`, Performance-Mechanik (Transferables, History-Cap)
- Stats/LineageTree/GenomeGraph/Commentary-Komponenten (Commentary-Texte angepasst)

## 3. Boot-Modell

### Zustand pro Boot
- `heading: Dir` — eine der 8 Kompassrichtungen (bestehender `Dir`-Typ, ohne CENTER). Ersetzt funktional `lastMoveDir`; das Feld `lastMoveDir` wird als Heading weiterverwendet, um Typ-Änderungen klein zu halten.
- Position bleibt diskret auf dem Grid (`loc: Coord`), Welt bleibt 128×128 (konfigurierbar).

### Bewegung pro Tick
1. Das Netz entscheidet über Drehen (siehe Aktionen): Heading dreht maximal ±45° pro Tick.
2. Das Boot segelt **automatisch** einen Schritt in Heading-Richtung — mit Wahrscheinlichkeit `polarSpeed(relWinkel)`, wobei `relWinkel` der Winkel zwischen Heading und Windrichtung (woher der Wind kommt) ist.
3. Ist die Zielzelle besetzt oder außerhalb, bleibt das Boot stehen (bestehende `queueForMove`-Logik).

### Polartabelle
Winkel zur Windquelle in 45°-Schritten (passt exakt zum 8-Richtungs-Grid):

| relWinkel | Kurs | Geschwindigkeit (= Move-Wahrscheinlichkeit/Tick) |
|---|---|---|
| 0° | im Wind (No-Go) | 0.05 |
| 45° | hart am Wind | 0.50 |
| 90° | Halbwind | 1.00 |
| 135° | Raumschots | 0.90 |
| 180° | Vorm Wind | 0.70 |

Die Tabelle liegt als Konstante in einer neuen Datei `src/simulation/sailing.ts` (zusammen mit Wind-State und Winkel-Helpern), damit Physik isoliert testbar ist.

## 4. Wind-Modell

- **Windrichtung:** eine der 8 Kompassrichtungen, global für alle Boote, konstant innerhalb einer Generation.
- **Windregime** (Parameter `windMode`):
  - `fixed` — Richtung bleibt über alle Generationen (Einsteiger-Preset, Debugging)
  - `rotate` — dreht alle `windRotatePeriod` Generationen um 45° (Default: alle 30 Gen.; sichtbarer Einbruch + Re-Adaptation im Fitness-Graph)
  - `random` — pro Generation zufällig (härteste Generalisierung)
- Keine separate Windstärke (YAGNI) — die Polartabelle ist die Stärke.
- Der Wind-State lebt im Simulator und wird in `endOfGeneration()` gemäß Regime aktualisiert; bei `deterministic` aus dem RNG-Seed reproduzierbar.

## 5. Sensoren (neu, 10 Inputs)

Alle normalisiert auf 0..1, Winkel als sin/cos-Paare (vermeidet die Unstetigkeit am Wraparound):

| Sensor | Bedeutung |
|---|---|
| `WIND_REL_X`, `WIND_REL_Y` | cos/sin des Windwinkels relativ zum Heading („bin ich in der No-Go-Zone?") |
| `TARGET_REL_X`, `TARGET_REL_Y` | cos/sin der Peilung zum Zielquadrant-Zentrum relativ zum Heading |
| `TARGET_DIST` | Distanz zum Zielzentrum, normalisiert auf Grid-Diagonale |
| `BOUNDARY_DIST` | wie bisher (Randnähe) |
| `SPEED` | gleitender Mittelwert der letzten Moves (merkt das Boot „ich komme nicht voran"?) |
| `AGE`, `OSC1`, `RANDOM` | wie bisher (OSC1 kann als Wende-Taktgeber zweckentfremdet werden) |

`NUM_SENSES` sinkt von 21 auf 10; das `sensorCache`-Pattern bleibt. `SPEED` wird als kleiner Ringpuffer/EMA am Indiv geführt (z.B. EMA über erfolgreiche Moves der letzten ~16 Ticks).

## 6. Aktionen (neu, 2 Outputs)

- `TURN_LEFT`, `TURN_RIGHT` — die Differenz der beiden Outputs wird durch `tanh` und `responsiveness` skaliert und probabilistisch in eine Drehung von −45°/0°/+45° übersetzt (gleiches Pattern wie die bisherige `prob2bool`-Bewegung).
- `NUM_ACTIONS` sinkt von 17 auf 2. `SET_RESPONSIVENESS`/`SET_OSCILLATOR_PERIOD` entfallen (Default-Werte bleiben aktiv).

Der kleine Aktions-/Sensorraum ist Absicht: Evolution verschwendet keine Genom-Kapazität auf nutzlose Verbindungen, Konvergenz wird deutlich schneller.

## 7. Challenge: `CHALLENGE_REGATTA`

### Setup pro Generation
- **Zielquadrant:** einer der 4 Quadranten (Parameter `targetQuadrant`: `0..3` fest oder `random` pro Generation; Default `random`). Zielzone = der volle Quadrant; „erreicht" = Boot betritt den Quadranten.
- **Spawning:** Boote spawnen gleichverteilt in der zielfernen Hälfte des Grids (Mindestdistanz `sizeX/2` vom Zielzentrum). Damit liegt das Ziel je nach Wind mal in Lee (leicht), mal in Luv (Kreuzen nötig).

### Tracking (Pattern von THE_TIDE/BOOMERANG)
In `endOfSimStep()`: Betritt ein lebendes Boot erstmals den Zielquadranten, wird in `challengeBits` der Ankunfts-Tick (untere 16 Bit) plus ein „finished"-Bit gespeichert. Das Boot segelt danach normal weiter (kein Despawn — die Zielzone füllt sich sichtbar).

### Fitness
- **Angekommen:** `score = 1 − ankunftsTick / stepsPerGeneration` → früher = besser. „Als erstes ankommen" wird so als kontinuierlicher Gradient abgebildet (robuster als ein hartes Platz-1-Kriterium, das für Selektion zu spärlich wäre).
- **Nicht angekommen:** `score = 0.2 × (1 − distZumZielzentrum / maxDist)` und trotzdem `passed = true` — damit Generation 0 nicht ausstirbt, läuft die Selektion nicht über hartes Überleben, sondern über den Score-Gradienten (`chooseParentsByFitness = true` als Default): Näher am Ziel ist besser, Ankommen schlägt alles.

## 8. Rendering & UI

### SimCanvas
- **Boote als Dreiecke**, rotiert nach `heading` (translate/rotate, Farbe weiterhin aus `genomeColor()`). Angekommene Boote bekommen einen dezenten Marker (z.B. gefüllter Punkt im Dreieck).
- **Windpfeil-Overlay:** ein großer halbtransparenter Pfeil in der Ecke + optional dünne Strich-Pfeile als Hintergrundraster.
- **Zielquadrant:** halbtransparent grün hinterlegt (ersetzt die Challenge-Overlays).
- Click-to-Inspect bleibt unverändert.

### ControlPanel / SplashScreen
- Neue Parameter: `windMode`, `windRotatePeriod`, `targetQuadrant`.
- SplashScreen-Presets (statt der bisherigen): „Erste Regatta" (windMode fixed), „Drehender Wind" (rotate), „Sturm-Lotterie" (random). Tutorial-Wizard-Texte aufs Segel-Szenario umgeschrieben.
- Branding: `package.json` name → `sailing-dots`, `index.html` Titel → „Sailing Dots — Segel-Evolution im Browser", App-Header/Splash-Texte.

### Commentary / Stats
- Bestehende Graphen (Survival-Rate, Diversity) bleiben; neue Kennzahlen: Ø-Ankunfts-Tick und Finisher-Quote pro Generation (in die bestehende `generation`-Message aufnehmen).
- Commentary-Trigger angepasst („Wind hat gedreht!", „Erstes Boot kreuzt gegen den Wind").

## 9. Parameter (Ergänzungen in `params.ts`)

```ts
windMode: 'fixed' | 'rotate' | 'random';   // Default: 'rotate'
windDirection: number;                      // Startrichtung 0..7, Default: N
windRotatePeriod: number;                   // Default: 30 Generationen
targetQuadrant: 0 | 1 | 2 | 3 | 'random';  // Default: 'random'
```

Entfernt werden: `killEnable`, `signalLayers`-abhängige Parameter, `barrierType` (auf `none` fixiert), `challenge` (nur noch REGATTA).

## 10. Worker-Protokoll

- `state`-Message wird um `heading` pro Agent (1 Byte im bestehenden ArrayBuffer-Layout) und um globalen Wind-State (`windDirection`, `targetQuadrant`) erweitert.
- `generation`-Message um `avgArrivalTick` und `finisherRate` erweitert.
- Commands unverändert; `updateConfig` transportiert die neuen Parameter.

## 11. Tests & Verifikation

Das Repo hat kein Test-Setup. Für die isolierte Segel-Physik wird `vitest` minimal ergänzt (nur `src/simulation/sailing.test.ts`):
- Polartabelle: korrekte Geschwindigkeit für alle 8 Relativwinkel
- Winkel-Helfer: Relativwinkel Heading↔Wind, Heading↔Zielpeilung inkl. Wraparound
- Regatta-Scoring: Ankunfts-Tick → Score, Trostpreis-Gradient

Verhaltens-Verifikation manuell über `npm run dev`: (a) bei Ziel in Lee laufen Boote nach ~30–50 Generationen direkt ab, (b) bei Ziel in Luv entstehen sichtbare Zickzack-Muster, (c) nach Winddrehung bricht die Finisher-Quote ein und erholt sich.

## 12. Risiken

- **Konvergenz-Bootstrap:** Wenn Gen 0 nie das Ziel erreicht, trägt der Trostpreis-Gradient die ersten ~20 Generationen. Falls das nicht reicht: Zielzonen-Radius initial vergrößern (Curriculum) — bewusst NICHT in dieser Spec, erst bei Bedarf.
- **No-Go-Zone zu hart:** 0.05 statt 0.0 verhindert komplettes Festsitzen; Feintuning der Polartabelle ist erwartbarer Balancing-Aufwand.
- **Remote:** `origin` zeigt noch auf `darwin-dots.git` — vor dem ersten Push neues GitHub-Repo anlegen und Remote umhängen.
