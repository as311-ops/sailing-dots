import type { GenomeProfile } from "../simulation/genome-profile";
import { humanLabel } from "../simulation/labels";

interface GenomeGraphProps {
  profile: GenomeProfile | null;
  width: number;
  height: number;
}

export default function GenomeGraph({ profile, width, height }: GenomeGraphProps) {
  if (!profile || profile.topConnections.length === 0) {
    return (
      <div
        className="bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-600 text-xs"
        style={{ width, height }}
      >
        Waiting for first generation...
      </div>
    );
  }

  return (
    <div
      className="bg-zinc-900 rounded-lg border border-zinc-800 p-2 flex flex-col"
      style={{ width, height }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 px-1 flex-shrink-0">
        <span className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase tracking-wider">
          Consensus Genome
          <span className="group/info relative inline-flex">
            <span className="flex h-3 w-3 cursor-help items-center justify-center rounded-full border border-zinc-600 text-[8px] font-bold normal-case text-zinc-500 hover:border-zinc-400 hover:text-zinc-300">
              i
            </span>
            <span className="pointer-events-none absolute left-0 bottom-5 z-20 hidden w-64 rounded-md border border-zinc-700 bg-zinc-950/95 p-2.5 text-[10px] normal-case leading-relaxed tracking-normal text-zinc-300 shadow-xl group-hover/info:block">
              <span className="mb-1 block font-semibold text-zinc-100">What the boats learned</span>
              The shared steering rules of the fastest survivors — the wiring almost every winner agrees on.
              <span className="mt-1.5 block text-zinc-400">
                Each row: <span className="text-zinc-200">73%</span> = share of winners with this link;
                <span className="text-emerald-500"> green →</span> the signal urges the turn,
                <span className="text-red-500"> red →</span> suppresses it; the bar shows its strength.
              </span>
              <span className="mt-1.5 block text-zinc-400">
                In sailing terms:
                <span className="block"><span className="text-cyan-400">Wind Angle → Turn</span> = beating upwind (you can't sail into the ±45° no-go zone, so you tack).</span>
                <span className="block"><span className="text-cyan-400">Internal Clock → Turn</span> = the rhythm for when to tack.</span>
                <span className="block"><span className="text-cyan-400">Target Bearing → Turn</span> = steering for the mark when the wind allows it.</span>
              </span>
            </span>
          </span>
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">
          {profile.avgGenomeLength}G / {profile.avgNeuronCount}N
        </span>
      </div>

      {/* Connection list */}
      <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
        {profile.topConnections.map((c, i) => {
          const pct = Math.round(c.frequency * 100);
          const isPositive = c.avgWeight >= 0;

          return (
            <div key={i} className="flex items-center gap-1 text-[10px] h-[18px]">
              {/* Frequency bar */}
              <div className="w-6 flex-shrink-0 text-right font-mono text-zinc-600">
                {pct}%
              </div>

              {/* From */}
              <span className={`flex-shrink-0 ${c.fromType === 'sensor' ? 'text-cyan-400' : 'text-violet-400'}`}>
                {humanLabel(c.from, c.fromType)}
              </span>

              {/* Arrow with weight color */}
              <span className={`flex-shrink-0 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                →
              </span>

              {/* To */}
              <span className={`flex-shrink-0 ${c.toType === 'action' ? 'text-amber-400' : 'text-violet-400'}`}>
                {humanLabel(c.to, c.toType)}
              </span>

              {/* Weight */}
              <div className="flex-1" />
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="w-8 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(Math.abs(c.avgWeight) / 4 * 100, 100)}%` }}
                  />
                </div>
                <span className="font-mono text-zinc-600 w-8 text-right">
                  {isPositive ? '+' : ''}{c.avgWeight.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-1.5 pt-1 border-t border-zinc-800 flex-shrink-0">
        <span className="text-[9px] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
          <span className="text-zinc-600">Sensor</span>
        </span>
        <span className="text-[9px] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
          <span className="text-zinc-600">Neuron</span>
        </span>
        <span className="text-[9px] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          <span className="text-zinc-600">Action</span>
        </span>
      </div>
    </div>
  );
}
