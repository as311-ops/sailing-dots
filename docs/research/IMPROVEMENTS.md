# Verbesserungsvorschläge für die Simulation

Abgeleitet aus der [Forschungsreihe E1–E7](./README.md). Jeder Vorschlag ist an einen konkreten Befund **und** an die betroffene Code-Stelle geknüpft. Keine dieser Änderungen ist umgesetzt — dies ist eine priorisierte Landkarte.

## Priorisierung (Impact × Aufwand)

| # | Verbesserung | Befund | Datei(en) | Impact | Aufwand |
|---|---|---|---|---|---|
| 1 | **VMG-geformte Fitness + No-Go-Strafe** | E2, E5 | `survival.ts`, `simulator.ts` | ★★★ | mittel |
| 2 | **Fitness von Gate-Stau entkoppeln** | E1, E7 | `survival.ts`, `sailing.ts` | ★★★ | klein |
| 3 | **Feinere Heading-/Polar-Auflösung (16 statt 8)** | E1, E2 | `types.ts`, `sailing.ts` | ★★★ | groß |
| 4 | **Sanftere Mutation (Gauß-Gewichte) + ausgerichtetes Crossover** | E3, E4 | `genome.ts` | ★★ | mittel |
| 5 | **Domain-Randomisierung / Multi-Bedingungs-Fitness als Default** | E6 | `params.ts`, `simulator.ts` | ★★ | mittel |
| 6 | **Seedbarer RNG verdrahten** | Methodik (E1–E7) | `random.ts`, `params.ts` | ★★ | klein |
| 7 | **Diversitäts-Erhalt (Niching / Immigranten)** | E7, E4 | `spawn.ts` | ★★ | mittel |
| 8 | **Curriculum-Lernen (leicht → schwer)** | E2, E5 | `simulator.ts`, `params.ts` | ★ | mittel |
| 9 | **Aussagekräftige UI-Metriken** | E1, E7 | `useSimulation.ts`, Komponenten | ★ | klein |

---

## 1 · VMG-geformte Fitness + No-Go-Strafe  ★★★  ✅ UMGESETZT

> **Status: umgesetzt.** Pro Tick wird die VMG zum Ziel akkumuliert (`simulator.ts` `endOfSimStep`) und als Effizienz-Signal in den Trostpreis der Nicht-Finisher geblendet (`survival.ts`, `VMG_BLEND = 0.4`). Felder `vmgAccum`/`vmgTicks` auf `Indiv` (`types.ts`), Unit-Tests in `survival.test.ts`. **Gemessen gegen die E2-Baseline (Beat, Seed 1):** No-Go-Zeit 51,6 % → 46,3 %, close-hauled 46,1 % → 51,3 % (Verhältnis kehrt sich um), Finisher der Klon-Flotte 9,3 % → 19,3 %. Der separate No-Go-Strafterm war unnötig — die VMG subsumiert ihn (Speed 0,05 im Wind → ~0 Reward).


**Befund.** Auf dem Beat findet die Evolution den richtigen Sektor (close-hauled), bleibt aber im **Überpinschen** stecken — 51,6 % der Zeit in der No-Go-Zone (E2). Mehr Neuronen helfen nicht (E5): das Problem ist die *Suche*, nicht die Repräsentation. Die Fitnesslandschaft ist rugged und schwach gradiert.

**Problem im Code.** `survival.ts` bewertet nur den Ankunfts-Tick plus einen Distanz-Trostpreis für Nicht-Finisher. Es gibt **kein** Signal, das tatsächlichen Vortrieb-zum-Ziel pro Schritt belohnt oder Stillstand im Wind bestraft. Ein Boot, das pinscht und stallt, bekommt fast denselben Gradienten wie eines, das sauber bei 45° segelt.

**Änderung.**
- Pro Schritt die **VMG (velocity made good)** Richtung aktuellem Ziel integrieren (Skalarprodukt aus Bewegung und Zielrichtung) und als geformten Reward in den Score einfließen lassen.
- Kleine **Strafe für Ticks in der No-Go-Zone** (Polar-Index 0, `relativeOctantSteps == 0`), damit Überpinschen Fitness kostet.
- Beides als zusätzlichen Term in `passedSurvivalCriterion`, gewichtet unter dem Finisher-Floor, damit Ankommen weiterhin dominiert.

**Erwartung.** Zieht die Population aus dem Pinsch-Optimum heraus Richtung produktivem 45°-Schlag — adressiert direkt die zentrale Schwäche, die E2 und E5 offengelegt haben. Höchster Hebel der ganzen Liste.

## 2 · Fitness von Gate-Stau entkoppeln  ★★★  ✅ UMGESETZT

> **Status: umgesetzt.** Ursache war nicht nur die Gate-Breite: gefinishte Boote segelten weiter und **blockierten mit ihrer Grid-Belegung** das Ziel. Fix (`simulator.ts`): Finisher werden eingefroren (kein Think/Move mehr in beiden Step-Loops) und ihre Grid-Zelle wird beim Finishen freigegeben (`grid.set(loc, 0)`). Rendering nutzt weiter `indiv.loc`, Finisher bleiben sichtbar. **Gemessen (close-hauled, Finisher-Rate je Population, vs. E7-Baseline):** 100: 58,7 % → 96,3 %, 300: 41,5 % → 81,1 %, 800: 18,6 % → 47,4 %. Große Flotten finishen 2–2,5× häufiger; die Rate ist viel weniger flottengrößen-abhängig. *Nebenwirkung:* Finisher parken jetzt an der Ziellinie statt weiterzusegeln — visuell ein Cluster am Gate (für die Regatta-Semantik eher korrekt; bei Bedarf verfeinerbar). Restgefälle bei sehr hoher Dichte (800 Boote im 160×160-Grid) bleibt — eine zusätzliche populationsabhängige Gate-Breite wäre die nächste Stufe, ist aber grid-größenbeschränkt.


**Befund.** Die Finisher-Rate saturiert bei ~50 % für alle Reaches (E1) und wird bei E7 nachweislich vom **Gedränge** dominiert: 30 Boote → 98 %, 800 Boote → 19 % — reiner Dichte-Effekt, keine Segelqualität.

**Problem im Code.** Das Ziel ist ein einzelnes schmales Gate (`finishGate`, Breite `max(16, sizeX/4)` in `sailing.ts`). „Gefinisht" = eine Gate-Zelle betreten. Bei großen Flotten ist das ein physischer Flaschenhals; die Kernmetrik mischt Können und Stau.

**Änderung.**
- Gate-Breite **mit der Populationsdichte skalieren**, oder Finish als „Ziel-Quadrant/Zone erreicht" definieren statt „eine von N Gate-Zellen" — dann ist Ankommen nicht kapazitätslimitiert.
- Alternativ/zusätzlich: Fitness primär über **Ankunftszeit bzw. VMG** statt über die Gate-Fraktion (siehe #1). E1 zeigt: die Ankunftszeit rankt sauber nach Geschwindigkeit, die Rate nicht.

**Erwartung.** Macht Vergleiche über Populationsgrößen und Kurse hinweg valide. Kleiner Aufwand, großer Effekt auf die Aussagekraft.

## 3 · Feinere Heading-/Polar-Auflösung  ★★★

**Befund.** E2: weil Headings Oktanten sind, liegen der produktive 45°-Schlag (Index 1) und die tote No-Go-Zone (Index 0) **direkt nebeneinander**. „So hoch wie möglich anliegen" überschießt zwangsläufig in den Stall. E1 zeigt zudem nur 5 grobe Polar-Stufen.

**Problem im Code.** `Compass` kennt 8 Richtungen; `POLAR_TABLE` hat 5 Einträge (`sailing.ts`). Es gibt keinen Zwischenwinkel, auf dem ein Boot sich einpendeln könnte.

**Änderung.**
- Heading auf **16 Richtungen (22,5°-Schritte)** erhöhen und die Polartabelle entsprechend verfeinern (oder kontinuierlich interpolieren).
- Damit existiert ein echter close-hauled-Winkel *zwischen* Stall und Halbwind — die Landschaft wird glatter, das Pinsch-Optimum weniger zwingend.

**Erwartung.** Glättet die rugged Beat-Landschaft aus #1/E2 an der Wurzel. Größter Aufwand (berührt Rendering, Sensoren, `asNormalizedCoord`, Rotation), aber strukturell die sauberste Lösung des Kreuz-Problems.

## 4 · Sanftere Mutation + besseres Crossover  ★★  ✅ UMGESETZT (teils)

> **Status: umgesetzt, gemischt validiert.** Zwei Änderungen in `genome.ts`, Unit-Tests in `genome.test.ts`:
> 1. **Gauß-Gewichts-Mutation** statt Bit-Flip — eine Mutation perturbiert das Gewicht um eine kleine Normalverteilung (std ≈ 0,15·8192), gesättigt statt wrappend. Beseitigt die Sign-Flip-Sprünge, die E3 als Sprödigkeit identifiziert hat. *Saubere Isolation nicht möglich:* durch #1/#2 ist der close-hauled-Kurs jetzt so leicht, dass Rate 0 gewinnt (77,7 %) und Mutation nur Rauschen ist — kein Mutations-Peak mehr, an dem sich der Nutzen zeigen ließe. Standard-Praxis der Neuroevolution, prinzipientreu und unit-getestet (kleine Schritte, int16-Sättigung), aber hier ohne messbaren Fitness-Gewinn.
> 2. **Struktur-bewusstes Crossover** — gleiche Verbindung in beiden Eltern → Gewichte mitteln (sichere Interpolation); sonst mit 50 % das ganze Gen erben (uniform, kein zusammenhängender Fremdblock). *Klar gemessen* (Sex vs. Klon, Klonen nutzt kein Crossover → isoliert den Operator): auf dem Beam-Reach schließt sich die Lücke, Verhältnis Sex/Klon **0,60 → 0,84** (Baseline-Abstand 35 Pkt → 13 Pkt). Auf dem brutalen Beat gewinnt Klonen weiter — die seltene, epistatische Lösung verträgt keine Rekombination.
>
> Fazit: Crossover ist ein gemessener Gewinn (Sex wieder konkurrenzfähig auf den meisten Kursen); die Gauß-Mutation ist ein sicherer, prinzipientreuer Fix, dessen Fitness-Effekt regime-abhängig und post-#1/#2 nicht sauber isolierbar ist.


**Befund.** E3: optimale Mutationsrate ≈ 0,12/Genom, eine Größenordnung unter Lehrbuch — das Genom ist **spröde**. E4: Crossover ist *destruktiv* (Klonen schlägt Sex 89 % vs. 54 %), weil es eng gekoppelte Genome zerreißt.

**Problem im Code.** `genome.ts` mutiert per **Bit-Flip** — auch hohe Bits eines int16-Gewichts, was riesige Sprünge erzeugt. Crossover kopiert das längere Genom und überlagert einen Zufalls-Slice des kürzeren (struktur-blind).

**Änderung.**
- **Gauß-Perturbation der Gewichte** (kleine Schritte) statt Bit-Flip der Gewichts-Bits → erlaubt höhere, nutzbare Mutationsraten und mildert die Sprödigkeit.
- **Ausgerichtetes Crossover**: Gene nach `source/sink` matchen und nur Gewichte tauschen, statt blind zu überlagern → bewahrt Building-Blocks, macht Sex wieder konkurrenzfähig.
- Default-`pointMutationRate` von 0,001 leicht Richtung 0,003–0,005 anheben (E3-Peak).

**Erwartung.** Macht Rekombination wieder nützlich und die Suche robuster — adressiert E3 und E4 mit einer gemeinsamen Ursache.

## 5 · Domain-Randomisierung als Default  ★★

**Befund.** E6: Spezialisten haben katastrophale blinde Flecken auf Bedingungen, die *schwerer* als ihr Training sind; Trainingsvielfalt regularisiert den Worst Case.

**Problem im Code.** Standard-Presets trainieren oft auf festem Wind / festem Ziel. Das erzeugt brüchige Spezialisten.

**Änderung.**
- Default-Training auf **`windMode: 'random'` + `targetQuadrant: -1`** (Wind *und* Ziel randomisiert).
- Optional **Multi-Bedingungs-Fitness**: jedes Genom pro Generation gegen mehrere Wind/Ziel-Stichproben bewerten und mitteln → selektiert direkt auf Generalisten, dämpft Lauf-zu-Lauf-Glück (E7).

**Erwartung.** Robustere, breiter einsetzbare Segler; weniger Overfitting auf den Demo-Kurs.

## 6 · Seedbaren RNG verdrahten  ★★  ✅ UMGESETZT

> **Status: umgesetzt.** `random.ts` hält jetzt einen optionalen mulberry32-PRNG mit `seedRng(seed)`/`clearRng()`/`isSeeded()`. `randomFloat`/`randomUint` nutzen den PRNG, wenn geseedet, sonst `Math.random` (so bleibt die Forschungs-Harness mit ihrem `Math.random`-Monkeypatch unverändert reproduzierbar). `genome.ts` zieht seine `randomUint`/`randomFloat` jetzt aus `random.ts` statt eigener `Math.random`-Kopien — damit folgen auch Mutation/Crossover dem Seed. `simulator.init()` ruft `seedRng(RNGSeed)` bzw. `clearRng()` je nach `params.deterministic`. Alle simulationsrelevante Zufälligkeit (Genome, Headings, Grid-Platzierung, Wind) läuft jetzt durch *einen* Strom; nur UI-Text (`commentary.ts`) bleibt auf `Math.random`. **Verifiziert** (`random.test.ts`): gleicher Seed → byte-gleiche Folge; End-to-End-Test → zwei Simulator-Läufe mit `deterministic:true, RNGSeed:777` liefern identische Finisher-Serien; `withSeed`-Pfad der Harness weiterhin reproduzierbar. Default bleibt `deterministic:false` → App-Verhalten unverändert.


**Befund.** Methodisch: die ganze Reihe musste `Math.random` monkeypatchen, um reproduzierbar zu sein.

**Problem im Code.** `params.ts` hat `RNGSeed` und `deterministic` — aber `random.ts` ruft schlicht `Math.random()` auf und **ignoriert beide**. Geteilte Genome/Läufe sind nicht reproduzierbar.

**Änderung.** Einen seedbaren PRNG (z. B. mulberry32, wie in `experiments/harness.ts`) in `random.ts` einbauen, initialisiert aus `RNGSeed`, wenn `deterministic` gesetzt ist.

**Erwartung.** Reproduzierbare Läufe in der App selbst, teilbare „Saat-Rennen", einfacheres Debugging — und die Experiment-Harness bräuchte keinen Monkeypatch mehr.

## 7 · Diversitäts-Erhalt  ★★

**Befund.** E7: kleine Populationen kollabieren zur Monokultur (Diversität 0,00); E4: selbst Klonen auf dem Reach erreicht Diversität 0,00 (vorzeitige Konvergenz).

**Problem im Code.** `spawn.ts` selektiert hart nach Fitness (`chooseParentsByFitness`), was Drift und vorzeitige Konvergenz beschleunigt — auf ruggeden Kursen riskant.

**Änderung.** Optionales **Fitness-Sharing/Niching**, gelegentliche **Zufalls-Immigranten**, oder **rang-/turnierbasierte Selektion** mit weicherem Druck. Diversität als Gesundheitssignal exponieren.

**Erwartung.** Erhält Exploration auf schweren Kursen, reduziert „stuck"-Läufe.

## 8 · Curriculum-Lernen  ★

**Befund.** E2/E5: der Beat ist such-limitiert; aus dem Pinsch-Optimum herauszufinden ist schwer.

**Änderung.** Schwierigkeit über Generationen rampen — erst Reaches/Halbwind, dann zunehmend dichter an den Wind. Boote bootstrappen Upwind-Verhalten aus leichteren Winkeln, statt es kalt auf dem Beat zu suchen.

**Erwartung.** Mögliche Flucht aus dem Überpinsch-Optimum, das #1 und #3 mildern, aber nicht garantiert auflösen.

## 9 · Aussagekräftige UI-Metriken  ★

**Befund.** E1/E7: die Finisher-Rate allein führt in die Irre (Stau-Confound, Sättigung).

**Änderung.** In der UI zusätzlich **Median-Ankunftszeit der Finisher**, **VMG/Effizienz** und **Diversitäts-Gesundheit** anzeigen (Warnung bei Kollaps). Datenfluss läuft über `useSimulation.ts` (`GenerationResult` trägt `avgArrivalTick`, `diversity` bereits).

**Erwartung.** Nutzer sehen Segelqualität statt eines stau-verzerrten Prozentwerts.

---

## Empfohlene Reihenfolge

1. **#6 (Seed)** + **#2 (Stau entkoppeln)** — klein, sofort, schaffen saubere Messbasis.
2. **#1 (VMG-Fitness)** — größter inhaltlicher Hebel auf das Kern-Kreuzproblem.
3. **#4 (Mutation/Crossover)** — macht die Suche robuster.
4. **#5 (Randomisierung)** — robustere Segler als Default.
5. **#3 (16 Richtungen)** — strukturelle Lösung, wenn der Aufwand sich lohnt.
6. **#7/#8/#9** — flankierend.

Die Befunde lassen sich auf eine Diagnose verdichten: **Das Kreuzen ist ein Suchproblem auf einer ruggeden Landschaft, und die aktuelle Fitness- und Diskretisierungs-Wahl verschärft das.** Die wirkungsvollsten Verbesserungen (#1, #2, #3) glätten die Landschaft und schärfen das Belohnungssignal — genau dort, wo Evolution heute hängenbleibt.
