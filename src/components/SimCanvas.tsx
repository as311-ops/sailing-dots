import { useRef, useEffect, useCallback, useState } from "react";
import { getChallengeOverlay, type OverlayShape } from "../simulation/challenge-overlay";
import { CHALLENGE_INFO } from "../simulation/challenge-descriptions";

export interface SimState {
  generation: number;
  simStep: number;
  population: number;
  survivors: number;
  agentLocations: Float32Array;
  agentColors: Uint8Array;
  agentHeadings: Uint8Array;
  agentFinished: Uint8Array;
  barrierLocations: Uint16Array;
  windFrom: number;
  targetQuadrant: number;
  courseLegs: number;
  preStartTicks: number;
  gridSize: { x: number; y: number };
}

interface SimCanvasProps {
  state: SimState | null;
  width: number;
  height: number;
  running?: boolean;
  onToggle?: () => void;
  /** Name/Beschreibung des gewählten Rennens für die Intro-Karte */
  raceName?: string;
  raceBrief?: string;
}

// Normalisierte Koordinaten je Compass-Wert (Index = Compass-Enum, y+ = Nord)
const COMPASS_XY: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

const COMPASS_LABELS = ['SW', 'S', 'SE', 'W', '·', 'E', 'NW', 'N', 'NE'];
const QUADRANT_LABELS = ['SW', 'SE', 'NW', 'NE'];

// Polartabelle (gespiegelt aus sailing.ts) — treibt die Bug-Schaum-Intensität:
// 0=im Wind (No-Go), 1=hart am Wind, 2=Halbwind, 3=raumschots, 4=vorm Wind.
const POLAR = [0.05, 0.5, 1.0, 0.9, 0.7];

/** Relative Bootsgeschwindigkeit (0..1) aus Heading vs. Windquelle — für Schaum/Effekte. */
function pointOfSailSpeed(heading: number, windFrom: number): number {
  const [hx, hy] = COMPASS_XY[heading] ?? [0, 1];
  const [wx, wy] = COMPASS_XY[windFrom] ?? [0, 1];
  let d = Math.abs(Math.atan2(hy, hx) - Math.atan2(wy, wx));
  if (d > Math.PI) d = 2 * Math.PI - d;
  const steps = Math.min(Math.round(d / (Math.PI / 4)), 4);
  return POLAR[steps];
}

interface Ripple { x: number; y: number; t0: number; }

export default function SimCanvas({
  state,
  width,
  height,
  running = false,
  onToggle,
  raceName,
  raceBrief,
}: SimCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevGenRef = useRef<number>(0);
  const [pulse, setPulse] = useState(false);
  const [flashIcon, setFlashIcon] = useState<'play' | 'pause' | null>(null);
  const spawnStartRef = useRef<number>(0);
  const [recording, setRecording] = useState(false);
  const [showChallengeIntro, setShowChallengeIntro] = useState(false);
  // Latest state for the continuous animation loop (avoids re-subscribing per update)
  const stateRef = useRef<SimState | null>(state);
  // Offscreen layer that holds fading wake trails, composited under the boats
  const wakeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Expanding gold rings spawned when boats cross the finish line
  const ripplesRef = useRef<Ripple[]>([]);
  // Tracks which boats already triggered a finish burst this episode
  const finishedSeenRef = useRef<Uint8Array | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (state?.generation === 0) setShowChallengeIntro(true);
  }, [state?.generation]);

  useEffect(() => {
    if (!showChallengeIntro) return;
    const id = setTimeout(() => setShowChallengeIntro(false), 3200);
    return () => clearTimeout(id);
  }, [showChallengeIntro]);

  // Detect generation change
  useEffect(() => {
    const gen = state?.generation ?? 0;
    if (gen !== prevGenRef.current) {
      prevGenRef.current = gen;
      spawnStartRef.current = performance.now();
      // New episode: clear wake trails and finish-burst tracking
      const wake = wakeCanvasRef.current;
      if (wake) wake.getContext("2d")?.clearRect(0, 0, wake.width, wake.height);
      ripplesRef.current = [];
      finishedSeenRef.current = null;
      if (gen > 0) {
        setPulse(true);
        const id = setTimeout(() => setPulse(false), 600);
        return () => clearTimeout(id);
      }
    }
  }, [state?.generation]);

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, now: number) => {
      const state = stateRef.current;
      if (!state) {
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#71717a";
        ctx.font = "14px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("Waiting for simulation...", width / 2, height / 2);
        return;
      }

      const { gridSize, agentLocations, agentColors, agentHeadings, agentFinished, barrierLocations, windFrom, targetQuadrant, courseLegs, preStartTicks } = state;
      const inPreStart = state.simStep < preStartTicks;
      const cellW = width / gridSize.x;
      const cellH = height / gridSize.y;
      // Grid-y+ = Nord, Canvas-y+ = unten → beim Zeichnen spiegeln
      const screenY = (gy: number) => (gridSize.y - 1 - gy) * cellH;

      // Background — Meer mit Tiefenverlauf
      const sea = ctx.createLinearGradient(0, 0, 0, height);
      sea.addColorStop(0, "#0c4a6e");
      sea.addColorStop(0.5, "#075985");
      sea.addColorStop(1, "#0c4a6e");
      ctx.fillStyle = sea;
      ctx.fillRect(0, 0, width, height);

      // ASCII-Wellen — deterministisch platziert, driften langsam mit dem Wind
      {
        const [wfx, wfy] = COMPASS_XY[windFrom] ?? [0, 1];
        const wlen = Math.sqrt(wfx * wfx + wfy * wfy) || 1;
        const driftSpeed = 0.018; // px pro ms — kontinuierlich, vom Sim-Takt entkoppelt
        const driftX = (-wfx / wlen) * now * driftSpeed;
        const driftY = (wfy / wlen) * now * driftSpeed;
        const waveFont = Math.max(width / 40, 12);
        const spacingX = waveFont * 3.2;
        const spacingY = waveFont * 2.4;
        ctx.font = `${waveFont}px ui-monospace, monospace`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(186, 230, 253, 0.14)";
        const mod = (v: number, m: number) => ((v % m) + m) % m;
        for (let row = -1; row * spacingY < height + spacingY; row++) {
          const stagger = (row * 137) % spacingX;
          const wy = mod(row * spacingY + driftY, height + spacingY) - spacingY / 2;
          for (let col = -1; col * spacingX < width + spacingX; col++) {
            const wx = mod(col * spacingX + stagger + driftX, width + spacingX) - spacingX / 2;
            ctx.fillText((row + col) % 3 === 0 ? "≈" : "~", wx, wy);
          }
        }
        ctx.textBaseline = "alphabetic";
      }

      // Windböen — weiche Streifen, die in Windrichtung über das Wasser ziehen
      {
        const [wfx, wfy] = COMPASS_XY[windFrom] ?? [0, 1];
        const wlen = Math.sqrt(wfx * wfx + wfy * wfy) || 1;
        const bx = -wfx / wlen;        // Wehrichtung X (Grid)
        const by = wfy / wlen;         // Screen-y gespiegelt
        const px = -by, py = bx;       // Senkrechte zur Windrichtung
        const diag = Math.sqrt(width * width + height * height);
        const travel = diag + 200;
        const GUSTS = 16;
        ctx.lineCap = "round";
        for (let k = 0; k < GUSTS; k++) {
          // Pseudo-zufällige, aber deterministische Streuung quer zum Wind
          const lateral = ((k * 73.398) % 1) * diag - diag / 2 + (k % 3) * 17;
          const speed = 0.05 + ((k * 31) % 7) * 0.012;
          const phase = ((now * speed + k * 137) % travel) - 100;
          const cx0 = width / 2 + px * lateral + bx * (phase - travel / 2);
          const cy0 = height / 2 + py * lateral + by * (phase - travel / 2);
          const segLen = 26 + (k % 5) * 10;
          // Sanftes Ein-/Ausblenden entlang der Bahn
          const fade = Math.sin((phase / travel) * Math.PI);
          if (fade <= 0) continue;
          ctx.strokeStyle = `rgba(224, 242, 254, ${0.05 * fade})`;
          ctx.lineWidth = 1.5 + (k % 3);
          ctx.beginPath();
          ctx.moveTo(cx0 - bx * segLen, cy0 - by * segLen);
          ctx.lineTo(cx0 + bx * segLen, cy0 + by * segLen);
          ctx.stroke();
        }
        ctx.lineCap = "butt";
      }

      // Vignette — dunklere Ränder für Tiefe/Atmosphäre
      {
        const vg = ctx.createRadialGradient(
          width / 2, height / 2, Math.min(width, height) * 0.35,
          width / 2, height / 2, Math.max(width, height) * 0.72,
        );
        vg.addColorStop(0, "rgba(2, 6, 23, 0)");
        vg.addColorStop(1, "rgba(2, 6, 23, 0.38)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, width, height);
      }

      // Subtle grid lines
      ctx.strokeStyle = "rgba(186, 230, 253, 0.05)";
      ctx.lineWidth = 0.5;
      if (cellW > 4) {
        for (let x = 0; x <= gridSize.x; x++) {
          ctx.beginPath();
          ctx.moveTo(x * cellW, 0);
          ctx.lineTo(x * cellW, height);
          ctx.stroke();
        }
        for (let y = 0; y <= gridSize.y; y++) {
          ctx.beginPath();
          ctx.moveTo(0, y * cellH);
          ctx.lineTo(width, y * cellH);
          ctx.stroke();
        }
      }

      // No-Go-Keil + Laylines am Zielquadranten — die Segeltaktik sichtbar machen:
      // direkt gegen den Wind geht nicht, man muss entlang der ±45°-Laylines anlaufen.
      if (targetQuadrant >= 0 && targetQuadrant < 4) {
        const tqx = (targetQuadrant & 1) === 0 ? gridSize.x / 4 : (3 * gridSize.x) / 4;
        const tqy = (targetQuadrant & 2) === 0 ? gridSize.y / 4 : (3 * gridSize.y) / 4;
        const mx = tqx * cellW;
        const my = (gridSize.y - 1 - tqy) * cellH;
        const [wfx, wfy] = COMPASS_XY[windFrom] ?? [0, 1];
        const wl = Math.sqrt(wfx * wfx + wfy * wfy) || 1;
        // "Upwind" = Richtung zur Windquelle, in Screen-Koordinaten (y gespiegelt)
        const ux = wfx / wl, uy = -wfy / wl;
        const ca = Math.cos(Math.PI / 4), sa = Math.sin(Math.PI / 4);
        const L = Math.sqrt(width * width + height * height);
        // Zwei Layline-Richtungen = Upwind um ±45° gedreht
        const l1x = ux * ca - uy * sa, l1y = ux * sa + uy * ca;
        const l2x = ux * ca + uy * sa, l2y = -ux * sa + uy * ca;

        // No-Go-Keil (kann nicht gesegelt werden) — schwach rot gefüllt
        ctx.fillStyle = "rgba(248, 113, 113, 0.07)";
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + l1x * L, my + l1y * L);
        ctx.lineTo(mx + l2x * L, my + l2y * L);
        ctx.closePath();
        ctx.fill();

        // Laylines — gestrichelt, dezent
        ctx.strokeStyle = "rgba(186, 230, 253, 0.28)";
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(mx, my); ctx.lineTo(mx + l1x * L, my + l1y * L);
        ctx.moveTo(mx, my); ctx.lineTo(mx + l2x * L, my + l2y * L);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Startlinie + Ziel-Gate + Kurs-Marken
      const shapes = getChallengeOverlay(targetQuadrant, courseLegs, gridSize.x, gridSize.y);
      drawOverlay(ctx, shapes, cellW, cellH, gridSize.y, `Finish ${QUADRANT_LABELS[targetQuadrant] ?? ''}`, inPreStart, preStartTicks - state.simStep, now);

      // Inseln (Barrieren) — sandfarben mit dunklerem Kern + Brandungssaum
      {
        const rr = Math.min(cellW, cellH) * 0.28;
        const foam = 0.6 + 0.4 * Math.sin(now * 0.004); // pulsierende Brandung
        for (let i = 0; i < barrierLocations.length; i += 2) {
          const bx = barrierLocations[i];
          const by = barrierLocations[i + 1];
          const x = bx * cellW, y = screenY(by);
          // Schaumsaum um die Insel
          ctx.strokeStyle = `rgba(224, 242, 254, ${0.22 * foam})`;
          ctx.lineWidth = Math.max(cellW * 0.18, 1);
          ctx.beginPath();
          ctx.roundRect(x - 0.5, y - 0.5, cellW + 1, cellH + 1, rr);
          ctx.stroke();
          ctx.fillStyle = "#ca8a04";
          ctx.beginPath();
          ctx.roundRect(x, y, cellW, cellH, rr);
          ctx.fill();
          ctx.fillStyle = "rgba(120, 53, 15, 0.55)";
          ctx.fillRect(x + cellW * 0.2, y + cellH * 0.2, cellW * 0.6, cellH * 0.6);
        }
      }

      // Kielwasser-Ebene: ausblenden und unter die Boote kopieren
      const wake = wakeCanvasRef.current;
      const wctx = wake ? wake.getContext("2d") : null;
      if (wctx) {
        wctx.globalCompositeOperation = "destination-out";
        wctx.fillStyle = "rgba(0, 0, 0, 0.06)"; // fade rate → Spurlänge
        wctx.fillRect(0, 0, wake!.width, wake!.height);
        wctx.globalCompositeOperation = "source-over";
        ctx.drawImage(wake!, 0, 0);
      }

      // Boote — spawn animation: gradually reveal over 2s with ease-in curve
      const boatRadius = Math.max(cellW * 0.45, 2.0);
      const spawnElapsed = performance.now() - spawnStartRef.current;
      const spawnDuration = 2000;
      const totalAgents = agentLocations.length / 2;
      let visibleCount: number;
      if (spawnElapsed >= spawnDuration) {
        visibleCount = totalAgents;
      } else {
        const t = spawnElapsed / spawnDuration;
        const eased = t * t * t; // cubic ease-in: starts slow, accelerates
        visibleCount = Math.floor(totalAgents * eased);
      }

      // Erster Durchgang: noch nicht gefinishte Boote in Genom-Farbe;
      // Finisher werden vorgemerkt und danach golden obendrauf gezeichnet.
      // Schatten + Bug-Schaum nur bei größeren Booten (skaliert mit der Flottengröße).
      const detail = boatRadius >= 3;
      const finishers: number[] = [];
      for (let i = 0; i < visibleCount; i++) {
        if (agentFinished[i]) { finishers.push(i); continue; }
        const ax = agentLocations[i * 2];
        const ay = agentLocations[i * 2 + 1];
        const ci = i * 3;
        const r = agentColors[ci] ?? 128;
        const g = agentColors[ci + 1] ?? 128;
        const b = agentColors[ci + 2] ?? 128;
        const [hx, hy] = COMPASS_XY[agentHeadings[i] ?? 7];
        // Screen-Winkel: Grid-y nach oben → Canvas-y negieren
        const angle = Math.atan2(-hy, hx);
        const cxp = ax * cellW + cellW / 2;
        const cyp = screenY(ay) + cellH / 2;

        // Kielwasser am Heck in die Wake-Ebene stempeln (erscheint im nächsten Frame).
        // Nur bei größeren Booten/kleineren Flotten — sonst überlagern sich tausende
        // Stempel zu einem hellen Blob statt lesbarer Spuren.
        if (wctx && detail) {
          const shl = Math.hypot(hx, hy) || 1;
          wctx.fillStyle = "rgba(190, 225, 255, 0.42)";
          wctx.beginPath();
          wctx.arc(cxp - (hx / shl) * boatRadius * 0.8, cyp + (hy / shl) * boatRadius * 0.8, Math.max(boatRadius * 0.42, 0.8), 0, Math.PI * 2);
          wctx.fill();
        }

        ctx.save();
        ctx.translate(cxp, cyp);
        if (detail) {
          // Wasserschatten
          ctx.fillStyle = "rgba(2, 6, 23, 0.28)";
          ctx.beginPath();
          ctx.ellipse(boatRadius * 0.15, boatRadius * 0.35, boatRadius * 0.95, boatRadius * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.rotate(angle);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.moveTo(boatRadius, 0);
        ctx.lineTo(-boatRadius * 0.7, boatRadius * 0.6);
        ctx.lineTo(-boatRadius * 0.7, -boatRadius * 0.6);
        ctx.closePath();
        ctx.fill();
        if (detail) {
          // Bug-Schaum — Intensität an die Polartabellen-Geschwindigkeit gekoppelt
          const spd = pointOfSailSpeed(agentHeadings[i] ?? 7, windFrom);
          if (spd > 0.55) {
            ctx.fillStyle = `rgba(235, 248, 255, ${0.55 * spd})`;
            ctx.beginPath();
            ctx.arc(boatRadius * 1.15, 0, boatRadius * 0.32, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Zweiter Durchgang: Sieger, die die Ziellinie überquert haben — satt
      // golden, größer und mit dunkelgoldener Umrandung für den Metallic-Look,
      // damit sie aus der Flotte herausstechen.
      if (finishers.length > 0) {
        const winRadius = boatRadius * 1.55;
        ctx.strokeStyle = "#7a5c00"; // dunkles Gold als Kontur
        ctx.lineWidth = Math.max(cellW * 0.14, 0.8);
        for (const i of finishers) {
          const ax = agentLocations[i * 2];
          const ay = agentLocations[i * 2 + 1];
          const [hx, hy] = COMPASS_XY[agentHeadings[i] ?? 7];
          const angle = Math.atan2(-hy, hx);

          ctx.save();
          ctx.translate(ax * cellW + cellW / 2, screenY(ay) + cellH / 2);
          ctx.rotate(angle);
          ctx.fillStyle = "#ffbf00"; // sattes Amber-Gold
          ctx.beginPath();
          ctx.moveTo(winRadius, 0);
          ctx.lineTo(-winRadius * 0.7, winRadius * 0.6);
          ctx.lineTo(-winRadius * 0.7, -winRadius * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // Finish-Funken: frisch eingelaufene Boote mit einem goldenen Ring feiern
      {
        const n = agentFinished.length;
        let seen = finishedSeenRef.current;
        if (!seen || seen.length !== n) { seen = new Uint8Array(n); finishedSeenRef.current = seen; }
        let spawned = 0;
        for (let i = 0; i < n; i++) {
          if (agentFinished[i] && !seen[i]) {
            seen[i] = 1;
            if (spawned < 8 && ripplesRef.current.length < 40) {
              const ax = agentLocations[i * 2];
              const ay = agentLocations[i * 2 + 1];
              ripplesRef.current.push({ x: ax * cellW + cellW / 2, y: screenY(ay) + cellH / 2, t0: now });
              spawned++;
            }
          }
        }
        const DUR = 850, MAXR = Math.max(cellW * 3, 16);
        const live: Ripple[] = [];
        for (const rp of ripplesRef.current) {
          const age = now - rp.t0;
          if (age >= DUR) continue;
          live.push(rp);
          const t = age / DUR;
          ctx.strokeStyle = `rgba(255, 210, 80, ${0.7 * (1 - t)})`;
          ctx.lineWidth = 2 * (1 - t) + 0.5;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, t * MAXR, 0, Math.PI * 2);
          ctx.stroke();
        }
        ripplesRef.current = live;
      }

      // Wind-Anzeige (oben rechts): Pfeil zeigt, WOHIN der Wind weht
      {
        const [fx, fy] = COMPASS_XY[windFrom] ?? [0, 1];
        const len = Math.sqrt(fx * fx + fy * fy) || 1;
        // Wehrichtung = -from; Screen-y gespiegelt
        const bx = -fx / len;
        const by = fy / len;
        const cx = width - 38;
        const cy = 38;
        const r = 20;

        ctx.fillStyle = "rgba(2, 6, 23, 0.75)";
        ctx.beginPath();
        ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.25 + 0.15 * Math.sin(now * 0.003)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - bx * r, cy - by * r);
        ctx.lineTo(cx + bx * r, cy + by * r);
        ctx.stroke();
        // Pfeilspitze
        const tipX = cx + bx * r;
        const tipY = cy + by * r;
        const aAng = Math.atan2(by, bx);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - 7 * Math.cos(aAng - 0.45), tipY - 7 * Math.sin(aAng - 0.45));
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - 7 * Math.cos(aAng + 0.45), tipY - 7 * Math.sin(aAng + 0.45));
        ctx.stroke();

        ctx.font = "bold 9px ui-monospace, monospace";
        ctx.fillStyle = "rgba(56, 189, 248, 0.9)";
        ctx.textAlign = "center";
        ctx.fillText(`Wind ${COMPASS_LABELS[windFrom] ?? ''}`, cx, cy + r + 18);
      }

      // Compass labels (drawn last, on top of everything)
      ctx.font = "bold 10px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "rgba(161, 161, 170, 0.6)";
      ctx.textAlign = "center";
      ctx.fillText("N", width / 2, 12);
      ctx.fillText("S", width / 2, height - 5);
      ctx.textAlign = "left";
      ctx.fillText("W", 4, height / 2 + 4);
      ctx.textAlign = "right";
      ctx.fillText("E", width - 4, height / 2 + 4);

      // Gewinner-Counter (oben links): wie viele Boote in dieser Episode
      // bereits die Ziellinie überquert haben.
      {
        let finishedCount = 0;
        for (let i = 0; i < agentFinished.length; i++) finishedCount += agentFinished[i];
        const total = agentFinished.length;

        const numText = String(finishedCount);
        const bx = 10, by = 10, boxH = 26, triW = 14, gap = 6, padX = 9;
        ctx.font = "bold 15px ui-monospace, monospace";
        const numW = ctx.measureText(numText).width;
        ctx.font = "9px ui-sans-serif, system-ui, sans-serif";
        const labelText = `/ ${total} FINISHED`;
        const labelW = ctx.measureText(labelText).width;
        const boxW = padX + triW + gap + numW + gap + labelW + padX;

        ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
        ctx.strokeStyle = "rgba(255, 191, 0, 0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 5);
        ctx.fill();
        ctx.stroke();

        const midY = by + boxH / 2;

        // Goldenes Sieger-Dreieck als Icon (zeigt nach rechts)
        const ix = bx + padX + triW / 2;
        ctx.save();
        ctx.translate(ix, midY);
        ctx.fillStyle = "#ffbf00";
        ctx.strokeStyle = "#7a5c00";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, 3.5);
        ctx.lineTo(-4, -3.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const numX = bx + padX + triW + gap;
        ctx.font = "bold 15px ui-monospace, monospace";
        ctx.fillStyle = "#ffbf00";
        ctx.fillText(numText, numX, midY + 0.5);

        ctx.font = "9px ui-sans-serif, system-ui, sans-serif";
        ctx.fillStyle = "rgba(253, 224, 130, 0.65)";
        ctx.fillText(labelText, numX + numW + gap, midY + 0.5);
        ctx.textBaseline = "alphabetic";
      }
    },
    [width, height]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    // Wake-Ebene in passender Größe (neu) anlegen
    const wake = document.createElement("canvas");
    wake.width = width;
    wake.height = height;
    wakeCanvasRef.current = wake;

    // Dauerhafte Animationsschleife: Wasser, Wind, Kielwasser und Effekte laufen
    // kontinuierlich, entkoppelt vom diskreten Simulations-Takt.
    let rafId: number;
    const loop = (now: number) => {
      drawFrame(ctx, now);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      wakeCanvasRef.current = null;
    };
  }, [drawFrame, width, height]);

  const handleClick = useCallback(() => {
    if (!onToggle) return;
    onToggle();
    setFlashIcon(running ? 'pause' : 'play');
    const id = setTimeout(() => setFlashIcon(null), 700);
    return () => clearTimeout(id);
  }, [onToggle, running]);

  const handleScreenshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `sailing-dots-gen${state?.generation ?? 0}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [state?.generation]);

  const handleRecord = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || recording) return;
    const stream = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `sailing-dots-gen${state?.generation ?? 0}.webm`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      setRecording(false);
    };
    setRecording(true);
    recorder.start();
    setTimeout(() => recorder.stop(), 3000);
  }, [recording, state?.generation]);

  return (
    <div
      className="rounded-lg transition-shadow duration-500 ease-out relative"
      style={{
        boxShadow: pulse
          ? '0 0 24px 6px rgba(52, 211, 153, 0.5), 0 0 8px 2px rgba(52, 211, 153, 0.7), inset 0 0 12px 2px rgba(52, 211, 153, 0.2)'
          : 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        className="rounded-lg border border-zinc-800 cursor-pointer block"
        style={{ width, height }}
        onClick={handleClick}
      />
      {/* Screenshot / Record buttons */}
      <div className="absolute bottom-2 right-2 flex gap-1.5 pointer-events-auto">
        <button
          onClick={(e) => { e.stopPropagation(); handleScreenshot(); }}
          title="Screenshot (PNG)"
          className="bg-black/50 hover:bg-black/80 text-zinc-400 hover:text-white rounded p-1.5 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleRecord(); }}
          title={recording ? 'Aufnahme läuft… (3s)' : 'Video aufnehmen (3s WebM)'}
          disabled={recording}
          className={`rounded p-1.5 transition-colors ${
            recording
              ? 'bg-red-600/80 text-white cursor-not-allowed'
              : 'bg-black/50 hover:bg-black/80 text-zinc-400 hover:text-red-400'
          }`}
        >
          {recording ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="6"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
          )}
        </button>
      </div>

      {flashIcon && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg"
          style={{ animation: 'fadeOutIcon 0.7s ease-out forwards' }}
        >
          <div className="bg-black/60 rounded-full p-4">
            {flashIcon === 'play' ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                <rect x="5" y="3" width="4" height="18" />
                <rect x="15" y="3" width="4" height="18" />
              </svg>
            )}
          </div>
        </div>
      )}

      {showChallengeIntro && (() => {
        const info = CHALLENGE_INFO[0];
        const title = raceName ?? info?.title;
        const brief = raceBrief ?? info?.brief;
        if (!title) return null;
        return (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none rounded-lg"
            style={{ animation: 'challengeIntroFade 3.2s ease-out forwards' }}
          >
            <div className="bg-zinc-950/80 backdrop-blur-sm border border-zinc-700/50 rounded-xl px-6 py-4 max-w-[80%] text-center shadow-2xl">
              <div className="text-[10px] text-emerald-500 font-mono uppercase tracking-widest mb-1">Race</div>
              <div className="text-base font-bold text-zinc-100 mb-1">{title}</div>
              <div className="text-xs text-zinc-400 leading-snug">{brief}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlay drawing helpers
// ---------------------------------------------------------------------------

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  shapes: OverlayShape[],
  cellW: number,
  cellH: number,
  gridSizeY: number,
  label?: string,
  inPreStart = false,
  preStartRemaining = 0,
  now = 0,
) {
  // Zellenzentrum in Screen-Koordinaten (Grid-y+ = Nord → spiegeln)
  const px = (gx: number) => gx * cellW + cellW / 2;
  const py = (gy: number) => (gridSizeY - 1 - gy) * cellH + cellH / 2;
  // Sanftes Auf-/Ab-Schaukeln der Bojen auf der Dünung
  const bob = (seed: number) => Math.sin(now * 0.002 + seed) * Math.max(cellH * 0.18, 1.2);
  let labelDrawn = false;

  for (const shape of shapes) {
    switch (shape.type) {
      case 'finishline': {
        ctx.strokeStyle = "rgba(16, 185, 129, 0.85)";
        ctx.lineWidth = Math.max(cellH * 0.5, 2);
        ctx.setLineDash([cellW, cellW]); // Zielband-Schachbrett-Optik
        ctx.beginPath();
        ctx.moveTo(px(shape.x1) - cellW / 2, py(shape.y1));
        ctx.lineTo(px(shape.x2) + cellW / 2, py(shape.y2));
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }

      case 'startline': {
        // Vorstart: Linie leuchtet amber und zählt den Countdown herunter
        ctx.strokeStyle = inPreStart ? "rgba(251, 191, 36, 0.85)" : "rgba(250, 250, 250, 0.45)";
        ctx.lineWidth = inPreStart ? 2.5 : 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(px(shape.x1), py(shape.y1));
        ctx.lineTo(px(shape.x2), py(shape.y2));
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = inPreStart
          ? "bold 10px ui-monospace, monospace"
          : "9px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = inPreStart ? "rgba(251, 191, 36, 0.95)" : "rgba(250, 250, 250, 0.5)";
        const text = inPreStart ? `PRE-START ${preStartRemaining}` : "START";
        ctx.fillText(text, (px(shape.x1) + px(shape.x2)) / 2, py(shape.y1) - 6);
        break;
      }

      case 'buoy': {
        const r = Math.max(cellW * 0.7, 3);
        const bx = px(shape.cx);
        const by = py(shape.cy) + bob(shape.cx + shape.cy);
        ctx.fillStyle = "rgba(251, 146, 60, 0.95)"; // orange Boje
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Glanzpunkt
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.beginPath();
        ctx.arc(bx - r * 0.3, by - r * 0.3, Math.max(r * 0.25, 0.8), 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'mark': {
        // Zu rundende Kurs-Marke: Boje mit Rundungszone und Nummer
        const cx = px(shape.cx);
        const cy = py(shape.cy);
        ctx.strokeStyle = "rgba(251, 146, 60, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, shape.r * cellW, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        const r = Math.max(cellW * 0.9, 4);
        const my = cy + bob(shape.cx + shape.cy);
        ctx.fillStyle = "rgba(251, 146, 60, 0.95)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, my, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = `bold ${Math.max(r * 1.1, 8)}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(9, 9, 11, 0.9)";
        ctx.fillText(String(shape.n), cx, my);
        ctx.textBaseline = "alphabetic";
        break;
      }
    }

    // Label einmal zeichnen, unterhalb der Ziellinie
    if (!labelDrawn && label && shape.type === 'finishline') {
      labelDrawn = true;
      const lx = (px(shape.x1) + px(shape.x2)) / 2;
      let ly = py(shape.y1) + 18;
      ly = Math.min(ly, gridSizeY * cellH - 8);
      ly = Math.max(ly, 14);

      ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      const metrics = ctx.measureText(label);
      const pad = 4;
      ctx.fillStyle = "rgba(9, 9, 11, 0.7)";
      ctx.beginPath();
      ctx.roundRect(lx - metrics.width / 2 - pad, ly - 10, metrics.width + pad * 2, 14, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(16, 185, 129, 0.8)";
      ctx.fillText(label, lx, ly);
    }
  }
}
