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
  barrierLocations: Uint16Array;
  windFrom: number;
  targetQuadrant: number;
  gridSize: { x: number; y: number };
}

interface SimCanvasProps {
  state: SimState | null;
  width: number;
  height: number;
  running?: boolean;
  onToggle?: () => void;
}

// Normalisierte Koordinaten je Compass-Wert (Index = Compass-Enum, y+ = Nord)
const COMPASS_XY: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

const COMPASS_LABELS = ['SW', 'S', 'SE', 'W', '·', 'E', 'NW', 'N', 'NE'];
const QUADRANT_LABELS = ['SW', 'SE', 'NW', 'NE'];

export default function SimCanvas({
  state,
  width,
  height,
  running = false,
  onToggle,
}: SimCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevGenRef = useRef<number>(0);
  const [pulse, setPulse] = useState(false);
  const [flashIcon, setFlashIcon] = useState<'play' | 'pause' | null>(null);
  const spawnStartRef = useRef<number>(0);
  const [recording, setRecording] = useState(false);
  const [showChallengeIntro, setShowChallengeIntro] = useState(false);

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
      if (gen > 0) {
        setPulse(true);
        const id = setTimeout(() => setPulse(false), 600);
        return () => clearTimeout(id);
      }
    }
  }, [state?.generation]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!state) {
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#71717a";
        ctx.font = "14px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("Waiting for simulation...", width / 2, height / 2);
        return;
      }

      const { gridSize, agentLocations, agentColors, agentHeadings, barrierLocations, windFrom, targetQuadrant } = state;
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
        const driftSpeed = 0.4;
        const driftX = (-wfx / wlen) * state.simStep * driftSpeed;
        const driftY = (wfy / wlen) * state.simStep * driftSpeed;
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

      // Zielzonen-Overlay
      const shapes = getChallengeOverlay(targetQuadrant, gridSize.x, gridSize.y);
      drawOverlay(ctx, shapes, cellW, cellH, gridSize.y, `Target ${QUADRANT_LABELS[targetQuadrant] ?? ''}`);

      // Barriers
      ctx.fillStyle = "#52525b";
      for (let i = 0; i < barrierLocations.length; i += 2) {
        const bx = barrierLocations[i];
        const by = barrierLocations[i + 1];
        ctx.fillRect(bx * cellW, screenY(by), cellW, cellH);
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

      for (let i = 0; i < visibleCount; i++) {
        const ax = agentLocations[i * 2];
        const ay = agentLocations[i * 2 + 1];
        const ci = i * 3;
        const r = agentColors[ci] ?? 128;
        const g = agentColors[ci + 1] ?? 128;
        const b = agentColors[ci + 2] ?? 128;
        const [hx, hy] = COMPASS_XY[agentHeadings[i] ?? 7];
        // Screen-Winkel: Grid-y nach oben → Canvas-y negieren
        const angle = Math.atan2(-hy, hx);

        ctx.save();
        ctx.translate(ax * cellW + cellW / 2, screenY(ay) + cellH / 2);
        ctx.rotate(angle);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.moveTo(boatRadius, 0);
        ctx.lineTo(-boatRadius * 0.7, boatRadius * 0.6);
        ctx.lineTo(-boatRadius * 0.7, -boatRadius * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
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
        ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
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
    },
    [state, width, height]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    draw(ctx);

    // Continuous redraws during spawn animation
    const spawnElapsed = performance.now() - spawnStartRef.current;
    if (spawnElapsed < 2000) {
      let rafId: number;
      const animate = () => {
        if (performance.now() - spawnStartRef.current >= 2000) return;
        draw(ctx);
        rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(rafId);
    }
  }, [draw, width, height]);

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
        if (!info) return null;
        return (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none rounded-lg"
            style={{ animation: 'challengeIntroFade 3.2s ease-out forwards' }}
          >
            <div className="bg-zinc-950/80 backdrop-blur-sm border border-zinc-700/50 rounded-xl px-6 py-4 max-w-[80%] text-center shadow-2xl">
              <div className="text-[10px] text-emerald-500 font-mono uppercase tracking-widest mb-1">Challenge</div>
              <div className="text-base font-bold text-zinc-100 mb-1">{info.title}</div>
              <div className="text-xs text-zinc-400 leading-snug">{info.brief}</div>
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
) {
  let labelDrawn = false;
  for (const shape of shapes) {
    switch (shape.type) {
      case 'circle': {
        ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
        ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(
          shape.cx * cellW + cellW / 2,
          (gridSizeY - 1 - shape.cy) * cellH + cellH / 2,
          shape.radius * cellW,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }

      case 'rect': {
        // Grid-y+ = Nord → Rechteck vertikal spiegeln
        const sx = shape.x * cellW;
        const sy = (gridSizeY - shape.y - shape.h) * cellH;
        ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
        ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.fillRect(sx, sy, shape.w * cellW, shape.h * cellH);
        ctx.strokeRect(sx, sy, shape.w * cellW, shape.h * cellH);
        ctx.setLineDash([]);
        break;
      }
    }

    // Draw label once, positioned near the first shape
    if (!labelDrawn && label) {
      labelDrawn = true;
      let lx: number, ly: number;
      if (shape.type === 'circle') {
        lx = shape.cx * cellW + cellW / 2;
        ly = (gridSizeY - 1 - shape.cy) * cellH + cellH / 2 + shape.radius * cellW + 16;
      } else {
        lx = shape.x * cellW + (shape.w * cellW) / 2;
        ly = (gridSizeY - shape.y - shape.h) * cellH + (shape.h * cellH) / 2;
      }
      // Clamp within canvas bounds
      ly = Math.min(ly, gridSizeY * cellH - 8);
      ly = Math.max(ly, 14);
      lx = Math.max(lx, 10);

      ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      const metrics = ctx.measureText(label);
      const pad = 4;
      ctx.fillStyle = "rgba(9, 9, 11, 0.7)";
      ctx.beginPath();
      ctx.roundRect(lx - metrics.width / 2 - pad, ly - 10, metrics.width + pad * 2, 14, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(16, 185, 129, 0.7)";
      ctx.fillText(label, lx, ly);
    }
  }
}
