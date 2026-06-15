import { useRef, useEffect } from "react";

import type { GenomeProfile } from "../simulation/genome-profile";
import type { Genome } from "../simulation/types";

export interface GenerationStats {
  generation: number;
  survivors: number;
  population: number;
  diversity: number;
  avgFitness: number;
  avgNeuronCount: number;
  avgGenomeLength: number;
  genomeProfile: GenomeProfile | null;
  championGenome?: Genome | null;
}

interface StatsGraphProps {
  history: GenerationStats[];
  width: number;
  height: number;
}

export default function StatsGraph({ history, width, height }: StatsGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    const pad = { top: 8, right: 8, bottom: 20, left: 40 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    // Background
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);

    if (history.length < 2) {
      ctx.fillStyle = "#52525b";
      ctx.font = "11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for data...", width / 2, height / 2);
      return;
    }

    // Grid lines
    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
    }

    // Survival rate line
    const maxPop = Math.max(...history.map((h) => h.population));
    const xScale = plotW / (history.length - 1);

    // Y-axis labels
    ctx.fillStyle = "#71717a";
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const pct = 100 - i * 25;
      const y = pad.top + (plotH / 4) * i;
      ctx.fillText(`${pct}%`, pad.left - 4, y + 3);
    }

    // X-axis
    ctx.textAlign = "center";
    const step = Math.max(1, Math.floor(history.length / 5));
    for (let i = 0; i < history.length; i += step) {
      const x = pad.left + i * xScale;
      ctx.fillText(`${history[i].generation}`, x, height - 4);
    }

    // Survival rate curve
    ctx.beginPath();
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < history.length; i++) {
      const x = pad.left + i * xScale;
      const rate = maxPop > 0 ? history[i].survivors / maxPop : 0;
      const y = pad.top + plotH * (1 - rate);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Diversity curve
    ctx.beginPath();
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (let i = 0; i < history.length; i++) {
      const x = pad.left + i * xScale;
      const y = pad.top + plotH * (1 - Math.min(history[i].diversity, 1));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Brain size curve (avgNeuronCount normalized to max seen)
    const maxNeurons = Math.max(...history.map(h => h.avgNeuronCount), 1);
    ctx.beginPath();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 2]);
    for (let i = 0; i < history.length; i++) {
      const x = pad.left + i * xScale;
      const y = pad.top + plotH * (1 - history[i].avgNeuronCount / maxNeurons);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Right-axis label: neuron count scale
    ctx.fillStyle = "#f59e0b";
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${maxNeurons}N`, width - pad.right + 2, pad.top + 4);
    ctx.fillText("0N", width - pad.right + 2, pad.top + plotH + 3);

    // Legend
    const legendY = pad.top + 4;
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "left";

    ctx.fillStyle = "#10b981";
    ctx.fillRect(pad.left + 4, legendY, 8, 2);
    ctx.fillText("Finisher Rate", pad.left + 16, legendY + 4);

    ctx.fillStyle = "#6366f1";
    ctx.fillRect(pad.left + 110, legendY, 8, 2);
    ctx.fillText("Diversity", pad.left + 122, legendY + 4);

    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(pad.left + 192, legendY, 8, 2);
    ctx.fillText("Brain Size", pad.left + 204, legendY + 4);
  }, [history, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg border border-zinc-800"
      style={{ width, height }}
    />
  );
}
