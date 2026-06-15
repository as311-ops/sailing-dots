import { useState } from "react";
import type { SimConfig } from "./ControlPanel";
import { DEFAULT_CONFIG } from "./ControlPanel";

export interface Preset {
  name: string;
  description: string;
  config: Partial<SimConfig>;
}

export const PRESETS: Preset[] = [
  {
    name: "First Regatta",
    description: "Steady north wind, target downwind in the southeast. Learn to sail before you learn to fight the wind.",
    config: {
      windMode: 'fixed',
      windDirection: 7, // N
      targetQuadrant: 1, // SE — in Lee, einfach ablaufen
      population: 300,
      stepsPerGeneration: 450,
      maxGenerations: 200,
    },
  },
  {
    name: "Upwind Battle",
    description: "Steady north wind — but the target lies upwind in the northeast. Only boats that learn to tack will arrive.",
    config: {
      windMode: 'fixed',
      windDirection: 7, // N
      targetQuadrant: 3, // NE — in Luv, Kreuzen nötig
      population: 300,
      stepsPerGeneration: 750,
      maxGenerations: 500,
    },
  },
  {
    name: "Shifting Winds",
    description: "The wind rotates 45° every 30 generations, the target changes each race. Adapt or fall behind.",
    config: {
      windMode: 'rotate',
      windDirection: 7,
      windRotatePeriod: 30,
      targetQuadrant: -1,
      population: 300,
      stepsPerGeneration: 600,
      maxGenerations: 500,
    },
  },
  {
    name: "Storm Lottery",
    description: "Random wind and random target every single generation. Only true navigators survive this.",
    config: {
      windMode: 'random',
      targetQuadrant: -1,
      population: 300,
      stepsPerGeneration: 600,
      maxGenerations: 1000,
      genomeInitialLength: 32,
      maxNumberNeurons: 8,
    },
  },
  {
    name: "Island Hopping",
    description: "Six islands litter the course — and they reshuffle every race. Learn to read the water ahead.",
    config: {
      windMode: 'rotate',
      windDirection: 7,
      windRotatePeriod: 30,
      targetQuadrant: -1,
      islands: 6,
      population: 300,
      stepsPerGeneration: 750,
      maxGenerations: 500,
      genomeInitialLength: 32,
      maxNumberNeurons: 8,
    },
  },
  {
    name: "Triangle Course",
    description: "Round mark 1, then mark 2, then cross the gate. A real regatta course with three legs.",
    config: {
      windMode: 'fixed',
      windDirection: 7,
      targetQuadrant: -1,
      courseLegs: 3,
      population: 300,
      stepsPerGeneration: 1100,
      maxGenerations: 1000,
      genomeInitialLength: 40,
      maxNumberNeurons: 10,
    },
  },
  {
    name: "Match Race",
    description: "60 ticks of pre-start jockeying — cross the line early and your score gets slashed.",
    config: {
      windMode: 'random',
      targetQuadrant: -1,
      preStartTicks: 60,
      population: 300,
      stepsPerGeneration: 750,
      maxGenerations: 800,
      genomeInitialLength: 32,
      maxNumberNeurons: 8,
    },
  },
];

interface PresetsProps {
  onSelect: (config: SimConfig) => void;
  disabled?: boolean;
}

export default function PresetSelector({ onSelect, disabled }: PresetsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full bg-zinc-900 border border-zinc-800
                   rounded-lg px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <span>Presets</span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 mt-1">
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => { onSelect({ ...DEFAULT_CONFIG, ...preset.config }); setOpen(false); }}
                disabled={disabled}
                className="text-left bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40
                           rounded-md px-2.5 py-2 transition-colors group"
                title={preset.description}
              >
                <div className="text-xs text-zinc-200 group-hover:text-white font-medium">
                  {preset.name}
                </div>
                <div className="text-[10px] text-zinc-500 leading-tight mt-0.5 line-clamp-2">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
