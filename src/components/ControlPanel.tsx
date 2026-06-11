import { useState, useCallback, useEffect } from "react";
import type { SimState } from "./SimCanvas";
import type { Genome } from "../simulation/types";
import type { PerfStats } from "../hooks/useSimulation";
import type { CommentaryLine } from "../simulation/commentary";
import Commentary from "./Commentary";
import CreatureAvatar from "./CreatureAvatar";
import { PRESETS } from "./Presets";
import type { GenomeProfile } from "../simulation/genome-profile";
import { isSoundEnabled, setSoundEnabled } from "../simulation/sounds";

export interface SimConfig {
  sizeX: number;
  sizeY: number;
  population: number;
  stepsPerGeneration: number;
  maxGenerations: number; // not currently used as stop condition, just for ETA
  genomeInitialLength: number;
  maxNumberNeurons: number;
  pointMutationRate: number;
  sexualReproduction: boolean;
  chooseParentsByFitness: boolean;
  windMode: 'fixed' | 'rotate' | 'random';
  windDirection: number;    // Compass-Wert (7 = N)
  windRotatePeriod: number; // Generationen bis zur nächsten 45°-Drehung
  targetQuadrant: number;   // 0..3 fest, -1 = zufällig pro Generation
  islands: number;          // Anzahl Inseln (0 = offenes Meer)
  courseLegs: number;       // 1 = direkt, 2 = eine Marke, 3 = Dreieckskurs
  preStartTicks: number;    // Vorstart-Phase in Ticks (0 = aus)
  responsivenessCurveKFactor: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  sizeX: 128,
  sizeY: 128,
  population: 1000,
  stepsPerGeneration: 1000,
  maxGenerations: 500,
  genomeInitialLength: 24,
  maxNumberNeurons: 5,
  pointMutationRate: 0.001,
  sexualReproduction: true,
  chooseParentsByFitness: true,
  windMode: 'rotate',
  windDirection: 7, // Compass.N
  windRotatePeriod: 30,
  targetQuadrant: -1,
  islands: 0,
  courseLegs: 1,
  preStartTicks: 0,
  responsivenessCurveKFactor: 4,
};

const COURSE_NAMES: Record<number, string> = {
  1: "Sprint (direct to the gate)",
  2: "Two legs (round 1 mark)",
  3: "Triangle (round 2 marks)",
};

const WIND_MODE_NAMES: Record<string, string> = {
  fixed: "Fixed",
  rotate: "Rotating (45° steps)",
  random: "Random per Generation",
};

// Compass-Werte: SW=0, S=1, SE=2, W=3, E=5, NW=6, N=7, NE=8
const WIND_DIRECTION_NAMES: Record<number, string> = {
  7: "North",
  8: "Northeast",
  5: "East",
  2: "Southeast",
  1: "South",
  0: "Southwest",
  3: "West",
  6: "Northwest",
};

const TARGET_QUADRANT_NAMES: Record<number, string> = {
  [-1]: "Random per Generation",
  0: "Southwest",
  1: "Southeast",
  2: "Northwest",
  3: "Northeast",
};

interface ControlPanelProps {
  config: SimConfig;
  onConfigChange: (config: SimConfig) => void;
  state: SimState | null;
  running: boolean;
  lastSurvivors: number;
  lastGeneration: number;
  lastAvgFitness: number;
  perfStats: PerfStats | null;
  commentaryLines: CommentaryLine[];
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onPreset: (config: SimConfig, race?: { name: string; description: string }) => void;
  speed: number;
  onSpeedChange: (v: number) => void;
  championGenome?: Genome | null;
  onShareGenome?: () => void;
  genomeProfile?: GenomeProfile | null;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-300 font-mono">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-5 bg-transparent appearance-none cursor-pointer
                   [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-zinc-800
                   [&::-webkit-slider-runnable-track]:rounded-full
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-zinc-100 [&::-webkit-slider-thumb]:cursor-grab
                   [&::-webkit-slider-thumb]:-mt-1
                   [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-zinc-800
                   [&::-moz-range-track]:rounded-full
                   [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                   [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-zinc-100
                   [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab
                   disabled:opacity-40"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-xs text-zinc-400">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`w-8 h-4 rounded-full transition-colors relative ${
          checked ? "bg-emerald-600" : "bg-zinc-700"
        } disabled:opacity-40`}
      >
        <span
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export default function ControlPanel({
  config,
  onConfigChange,
  state,
  running,
  lastSurvivors,
  lastGeneration,
  lastAvgFitness,
  perfStats,
  commentaryLines,
  onStart,
  onPause,
  onReset,
  onPreset,
  speed,
  onSpeedChange,
  championGenome,
  onShareGenome,
  genomeProfile,
}: ControlPanelProps) {
  const [section, setSection] = useState<"sim" | "genome" | "wind">("sim");
  const [configOpen, setConfigOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const update = useCallback(
    <K extends keyof SimConfig>(key: K, value: SimConfig[K]) => {
      onConfigChange({ ...config, [key]: value });
    },
    [config, onConfigChange]
  );

  return (
    <div className="w-full flex flex-col gap-3 text-sm">
      {/* Survival Rate KPI */}
      <SurvivalKPI
        survivors={lastSurvivors}
        population={config.population}
        generation={lastGeneration}
        avgFitness={lastAvgFitness}
        running={running}
        genomeProfile={genomeProfile}
      />

      {/* Live Commentary */}
      <Commentary lines={commentaryLines} />

      {/* Header Stats */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 text-xs uppercase tracking-wider">Status</span>
          <span
            className={`text-xs font-mono px-2 py-0.5 rounded ${
              running
                ? "bg-emerald-950 text-emerald-400"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {running ? "Running" : "Paused"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-zinc-500">Generation</div>
            <div className="font-mono text-zinc-200 text-lg">
              {state?.generation ?? 0}
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Step</div>
            <div className="font-mono text-zinc-200 text-lg">
              {state?.simStep ?? 0}
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Population</div>
            <div className="font-mono text-zinc-200">
              {state?.population ?? config.population}
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Finishers</div>
            <div className="font-mono text-emerald-400">
              {state?.survivors ?? "–"}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 space-y-3">
        <div className="flex gap-2">
          {!running ? (
            <button
              onClick={onStart}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium
                         py-2 px-3 rounded-md transition-colors"
            >
              ▶ {state?.generation ? 'Resume' : 'Start'}
            </button>
          ) : (
            <button
              onClick={onPause}
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium
                         py-2 px-3 rounded-md transition-colors"
            >
              ⏸ Pause
            </button>
          )}
          {((state?.generation ?? 0) > 0 || running) && (
            <button
              onClick={onReset}
              className="bg-red-900 hover:bg-red-800 text-red-200 text-xs font-medium
                         py-2 px-3 rounded-md transition-colors"
            >
              ■ Stop
            </button>
          )}
        </div>
        <Slider
          label="Speed"
          value={speed}
          min={1}
          max={300}
          step={1}
          unit="×"
          onChange={onSpeedChange}
        />
      </div>

      {/* Share + Sound */}
      <div className="flex gap-2">
        {onShareGenome && (
          <button
            onClick={() => {
              onShareGenome();
              setCopied(true);
            }}
            disabled={!championGenome}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs
                       text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40
                       disabled:cursor-not-allowed"
          >
            {copied ? "Copied!" : "Share Genome"}
          </button>
        )}
        <button
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            setSoundEnabled(next);
          }}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs
                     text-zinc-400 hover:text-zinc-200 transition-colors"
          title={soundOn ? "Mute sounds" : "Enable sounds"}
        >
          {soundOn ? "🔊" : "🔇"}
        </button>
      </div>

      {/* Config & Presets Toggle */}
      <button
        onClick={() => setConfigOpen((v) => !v)}
        className="flex items-center justify-between w-full bg-zinc-900 border border-zinc-800
                   rounded-lg px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <span>Settings & Presets</span>
        <span className={`transition-transform ${configOpen ? "rotate-180" : ""}`}>▼</span>
      </button>

      {configOpen && <>
      {/* Presets */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Presets</div>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onPreset(
                { ...DEFAULT_CONFIG, ...preset.config },
                { name: preset.name, description: preset.description },
              )}
              disabled={running}
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

      {/* Section Tabs */}
      <div className="flex border border-zinc-800 rounded-lg overflow-hidden">
        {(["sim", "wind", "genome"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`flex-1 text-xs py-1.5 transition-colors ${
              section === s
                ? "bg-zinc-800 text-zinc-100"
                : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {s === "sim" ? "World" : s === "wind" ? "Wind" : "Genome"}
          </button>
        ))}
      </div>

      {/* Section Content */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 space-y-3 overflow-y-auto max-h-[400px]">
        {section === "sim" && (
          <>
            <Slider
              label="Population"
              value={config.population}
              min={100}
              max={5000}
              step={100}
              onChange={(v) => update("population", v)}
              disabled={running}
            />
            <Slider
              label="Steps/Gen."
              value={config.stepsPerGeneration}
              min={50}
              max={1000}
              step={50}
              onChange={(v) => update("stepsPerGeneration", v)}
              disabled={running}
            />
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Target Quadrant</label>
              <select
                value={config.targetQuadrant}
                onChange={(e) => update("targetQuadrant", Number(e.target.value))}
                disabled={running}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200
                           py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-zinc-600
                           disabled:opacity-40"
              >
                {Object.entries(TARGET_QUADRANT_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Course</label>
              <select
                value={config.courseLegs}
                onChange={(e) => update("courseLegs", Number(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200
                           py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              >
                {Object.entries(COURSE_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <Slider
              label="Islands"
              value={config.islands}
              min={0}
              max={8}
              step={1}
              onChange={(v) => update("islands", v)}
            />
            <Slider
              label="Pre-start phase"
              value={config.preStartTicks}
              min={0}
              max={120}
              step={10}
              unit=" ticks"
              onChange={(v) => update("preStartTicks", v)}
            />
          </>
        )}

        {section === "wind" && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Wind Mode</label>
              <select
                value={config.windMode}
                onChange={(e) => update("windMode", e.target.value as SimConfig["windMode"])}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200
                           py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              >
                {Object.entries(WIND_MODE_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {config.windMode !== "random" && (
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Wind Direction (from)</label>
                <select
                  value={config.windDirection}
                  onChange={(e) => update("windDirection", Number(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200
                             py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                >
                  {Object.entries(WIND_DIRECTION_NAMES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {config.windMode === "rotate" && (
              <Slider
                label="Rotate every"
                value={config.windRotatePeriod}
                min={5}
                max={100}
                step={5}
                unit=" gens"
                onChange={(v) => update("windRotatePeriod", v)}
              />
            )}
          </>
        )}

        {section === "genome" && (
          <>
            <Slider
              label="Genome Length"
              value={config.genomeInitialLength}
              min={4}
              max={64}
              step={2}
              onChange={(v) => update("genomeInitialLength", v)}
              disabled={running}
            />
            <Slider
              label="Max Neurons"
              value={config.maxNumberNeurons}
              min={1}
              max={20}
              step={1}
              onChange={(v) => update("maxNumberNeurons", v)}
              disabled={running}
            />
            <Slider
              label="Mutation Rate"
              value={config.pointMutationRate}
              min={0}
              max={0.05}
              step={0.001}
              onChange={(v) => update("pointMutationRate", v)}
            />
            <Toggle
              label="Sexual Reproduction"
              checked={config.sexualReproduction}
              onChange={(v) => update("sexualReproduction", v)}
            />
            <Toggle
              label="Fitness-Based Selection"
              checked={config.chooseParentsByFitness}
              onChange={(v) => update("chooseParentsByFitness", v)}
            />
            <Slider
              label="Response Curve K"
              value={config.responsivenessCurveKFactor}
              min={1}
              max={10}
              step={0.5}
              onChange={(v) => update("responsivenessCurveKFactor", v)}
            />
          </>
        )}
      </div>
      </>}
    </div>
  );
}

function SurvivalKPI({
  survivors,
  population,
  generation,
  avgFitness,
  running,
  genomeProfile,
}: {
  survivors: number;
  population: number;
  generation: number;
  avgFitness: number;
  running: boolean;
  genomeProfile?: GenomeProfile | null;
}) {
  const rate = population > 0 ? survivors / population : 0;
  const hasData = generation > 0;

  // If all finish, show fitness instead
  const allSurvive = hasData && rate >= 0.99;
  const displayRate = allSurvive ? avgFitness : rate;
  const pct = Math.round(displayRate * 100);
  const label = allSurvive ? 'Avg Fitness' : 'Finisher Rate';
  const detail = allSurvive
    ? `All finish — speed matters`
    : `${survivors} of ${population} reached the target`;

  // Color transitions: 0% = red, 30% = amber, 60%+ = green
  const color = !hasData
    ? 'text-zinc-600'
    : pct >= 60
      ? 'text-emerald-400'
      : pct >= 30
        ? 'text-amber-400'
        : pct > 0
          ? 'text-red-400'
          : 'text-red-500';

  const ringColor = !hasData
    ? 'stroke-zinc-800'
    : pct >= 60
      ? 'stroke-emerald-500'
      : pct >= 30
        ? 'stroke-amber-500'
        : 'stroke-red-500';

  const circumference = 2 * Math.PI * 34;
  const dashOffset = circumference - (circumference * (hasData ? displayRate : 0));

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 flex items-center gap-4">
      {/* Circular progress */}
      <div className="relative flex-shrink-0">
        <svg width="80" height="80" className="-rotate-90">
          <circle
            cx="40" cy="40" r="34"
            fill="none"
            stroke="#27272a"
            strokeWidth="5"
          />
          <circle
            cx="40" cy="40" r="34"
            fill="none"
            className={`${ringColor} transition-all duration-700`}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-mono font-bold text-xl ${color} transition-colors duration-700`}>
            {hasData ? `${pct}%` : '–'}
          </span>
        </div>
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="text-zinc-400 text-xs">{label}</div>
        <div className="text-zinc-500 text-[10px] mt-0.5">
          {hasData
            ? detail
            : running ? 'Waiting for gen. 1...' : 'Start the simulation'}
        </div>
        {hasData && (
          <div className="text-zinc-600 text-[10px] font-mono mt-0.5">
            Gen. {generation}
          </div>
        )}
      </div>

      {/* Typical Darwin Dot */}
      {genomeProfile && (
        <div className="flex-shrink-0 opacity-80">
          <CreatureAvatar profile={genomeProfile} compact />
        </div>
      )}
    </div>
  );
}
