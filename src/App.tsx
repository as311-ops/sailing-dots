import { useState, useCallback, useEffect, useRef } from "react";
import SimCanvas from "./components/SimCanvas";
import ControlPanel, {
  DEFAULT_CONFIG,
  type SimConfig,
} from "./components/ControlPanel";
import StatsGraph from "./components/StatsGraph";
import GenomeGraph from "./components/GenomeGraph";
import MatchSummaryModal from "./components/MatchSummary";
import ChallengeInfo from "./components/ChallengeInfo";
import SplashScreen from "./components/SplashScreen";
import TutorialWizard from "./components/TutorialWizard";
import DarwinLogo from "./components/DarwinLogo";
import { PRESETS } from "./components/Presets";
import { useSimulation } from "./hooks/useSimulation";
import type { PerfStats } from "./hooks/useSimulation";
import {
  generateCommentary,
  generateSummary,
  type CommentaryLine,
  type MatchSummary,
} from "./simulation/commentary";
import { genomeFromHash, genomeShareUrl, clearGenomeHash } from "./simulation/genome-codec";
import { playStart, playGenerationTick, playBreakthrough, playWipeout, playVictory, playShare } from "./simulation/sounds";
import type { Genome } from "./simulation/types";

const CHALLENGE_LABEL = "Regatta";

const IS_SCREENSAVER = new URLSearchParams(window.location.search).has("screensaver");
const SCREENSAVER_CYCLE_GENS = 100;
const SCREENSAVER_INITIAL_IDX = IS_SCREENSAVER ? Math.floor(Math.random() * PRESETS.length) : 0;

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

function useWindowWidth() {
  return useWindowSize().w;
}

function SparklineSVG({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 260, h = 48, pad = 6;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - Math.max(0, Math.min(1, v)) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lx, ly] = pts[pts.length - 1].split(',');
  return (
    <svg width={w} height={h} className="mx-auto" style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke="#10b981" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={lx} cy={ly} r="2.5" fill="#10b981" opacity="0.9" />
    </svg>
  );
}

function SsKpi({ banner }: { banner: { survivors: number; population: number; streak: number; sparkData?: number[] } }) {
  const { survivors, population, streak, sparkData } = banner;
  const rate = population > 0 ? survivors / population : 0;
  const pct = Math.round(rate * 100);

  const color = pct >= 60 ? 'text-emerald-400' : pct >= 30 ? 'text-amber-400' : pct > 0 ? 'text-red-400' : 'text-red-500';
  const ringColor = pct >= 60 ? 'stroke-emerald-500' : pct >= 30 ? 'stroke-amber-500' : 'stroke-red-500';
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - circumference * rate;

  return (
    <div className="absolute inset-x-0 bottom-16 flex justify-center pointer-events-none select-none">
      <div className="bg-zinc-950/80 backdrop-blur-sm border border-zinc-800/40 rounded-2xl px-7 py-4 flex items-center gap-5">
        {/* Circular progress */}
        <div className="relative flex-shrink-0">
          <svg width="100" height="100" className="-rotate-90">
            <circle cx="50" cy="50" r={r} fill="none" stroke="#27272a" strokeWidth="6" />
            <circle
              cx="50" cy="50" r={r}
              fill="none"
              className={`${ringColor} transition-all duration-700`}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-mono font-bold text-2xl ${color} transition-colors duration-700`}>{pct}%</span>
          </div>
        </div>
        {/* Stats + sparkline */}
        <div className="min-w-0">
          <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${color} transition-colors duration-700`}>
            {survivors.toLocaleString()} <span className="text-zinc-600 font-normal text-base">/ {population.toLocaleString()}</span>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">finisher rate</div>
          {streak > 1 && (
            <div className="text-[10px] text-zinc-600 font-mono mt-1.5">{streak} gens streak</div>
          )}
          {sparkData && sparkData.length >= 2 && (
            <div className="mt-2">
              <SparklineSVG data={sparkData} />
              <div className="text-[9px] text-zinc-700 mt-0.5 text-right">{sparkData.length} gens</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type RaceInfo = { name: string; description: string };

export default function App() {
  const [config, setConfig] = useState<SimConfig>(
    IS_SCREENSAVER ? { ...DEFAULT_CONFIG, ...PRESETS[SCREENSAVER_INITIAL_IDX].config } : DEFAULT_CONFIG
  );
  // Das gewählte Rennen (Preset) — steuert Banner, Canvas-Intro und Commentary
  const [race, setRace] = useState<RaceInfo | null>(
    IS_SCREENSAVER
      ? { name: PRESETS[SCREENSAVER_INITIAL_IDX].name, description: PRESETS[SCREENSAVER_INITIAL_IDX].description }
      : null
  );
  const [commentaryLines, setCommentaryLines] = useState<CommentaryLine[]>([]);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [summaryProfile, setSummaryProfile] = useState<import("./simulation/genome-profile").GenomeProfile | null>(null);
  const [summaryGenome, setSummaryGenome] = useState<Genome | null>(null);
  // Read seed genome synchronously before simulation init
  const [seedGenome] = useState<Genome | null>(() => {
    const genome = genomeFromHash();
    if (genome) clearGenomeHash();
    return genome;
  });
  const [showSplash, setShowSplash] = useState(!seedGenome && !IS_SCREENSAVER);
  const prevProfileRef = useRef<import("./simulation/genome-profile").GenomeProfile | null>(null);
  const screensaverPresetIdx = useRef(SCREENSAVER_INITIAL_IDX);
  type SsBanner = { survivors: number; population: number; streak: number; sparkData?: number[] };
  const [ssBanner, setSsBanner] = useState<SsBanner | null>(null);
  const [ssFlash, setSsFlash] = useState<'wipeout' | 'victory' | null>(null);
  const ssStreakRef = useRef(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialFromSplash = useRef(false);

  const screensaverInitConfig = IS_SCREENSAVER
    ? { ...DEFAULT_CONFIG, ...PRESETS[screensaverPresetIdx.current].config }
    : DEFAULT_CONFIG;

  const {
    state, running, history, genomeProfile, championGenome, perfStats, speed,
    start, pause, reset, changeSpeed, updateConfig,
  } = useSimulation(screensaverInitConfig, seedGenome);

  const windowWidth = useWindowWidth();
  const windowSize = useWindowSize();

  const handleShareGenome = useCallback(() => {
    if (!championGenome) return;
    const url = genomeShareUrl(championGenome);
    navigator.clipboard.writeText(url);
    playShare();
  }, [championGenome]);

  // Screensaver: auto-start + auto-cycle presets
  useEffect(() => {
    if (!IS_SCREENSAVER) return;
    const id = setTimeout(() => start(), 200);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!IS_SCREENSAVER || history.length === 0) return;
    const gen = history[history.length - 1].generation;
    if (gen > 0 && gen % SCREENSAVER_CYCLE_GENS === 0) {
      screensaverPresetIdx.current = Math.floor(Math.random() * PRESETS.length);
      const nextPreset = PRESETS[screensaverPresetIdx.current];
      const nextConfig = { ...DEFAULT_CONFIG, ...nextPreset.config };
      setConfig(nextConfig);
      setRace({ name: nextPreset.name, description: nextPreset.description });
      reset(nextConfig);
      setTimeout(() => start(), 100);
    }
  }, [history.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!IS_SCREENSAVER || history.length === 0) return;
    const last = history[history.length - 1];
    const rate = last.population > 0 ? last.survivors / last.population : 0;

    if (last.survivors === 0) ssStreakRef.current = 0;
    else ssStreakRef.current++;

    setSsFlash(last.survivors === 0 ? 'wipeout' : rate > 0.75 ? 'victory' : null);

    const sparkData = history.length >= 2
      ? history.slice(-100).map(h => h.population > 0 ? h.survivors / h.population : 0)
      : undefined;

    setSsBanner({ survivors: last.survivors, population: last.population, streak: ssStreakRef.current, sparkData });

    const flashId = setTimeout(() => setSsFlash(null), 1500);
    return () => clearTimeout(flashId);
  }, [history.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (IS_SCREENSAVER || seedGenome) return;
    try {
      if (!localStorage.getItem('sailing_dots_tutorial_seen')) {
        tutorialFromSplash.current = true;
        setShowTutorial(true);
      }
    } catch { /* localStorage nicht verfügbar */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Responsive breakpoints
  const isNarrow = windowWidth < 900;
  const sidebarW = isNarrow ? Math.min(windowWidth - 32, 400) : 300;
  const canvasSize = isNarrow
    ? Math.min(windowWidth - 32, 560)
    : Math.min(windowWidth - sidebarW - 64, 880);
  const fullW = isNarrow ? Math.min(windowWidth - 32, 500) : canvasSize;

  // Generate commentary when new generation stats arrive
  const historyLen = history.length;
  const lastGeneration = historyLen > 0 ? history[historyLen - 1].generation : -1;

  useEffect(() => {
    if (historyLen < 1) return;
    const lastStats = history[historyLen - 1];
    const prevStats = historyLen > 1 ? history[historyLen - 2] : null;

    const lines = generateCommentary({
      generation: lastStats.generation,
      survivors: lastStats.survivors,
      population: lastStats.population,
      diversity: lastStats.diversity,
      genomeProfile: genomeProfile,
      prevSurvivors: prevStats?.survivors ?? 0,
      prevDiversity: prevStats?.diversity ?? 0,
      prevProfile: prevProfileRef.current,
      challengeName: race?.name ?? CHALLENGE_LABEL,
    });

    if (lines.length > 0) {
      setCommentaryLines((prev) => [...prev.slice(-30), ...lines]);
      // Sound triggers based on commentary type
      if (lines.some(l => l.type === 'hype')) playBreakthrough();
      else if (lines.some(l => l.type === 'concern' && lastStats.survivors === 0)) playWipeout();
      else playGenerationTick();
    } else {
      playGenerationTick();
    }
    prevProfileRef.current = genomeProfile;
  }, [lastGeneration]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hinweis: Das Match-Summary-Modal wird ausschließlich beim expliziten Stop
  // (handleReset) geöffnet. Ein früherer useEffect öffnete es bei JEDEM Übergang
  // running→false und damit auch bei einer simplen Pause (Canvas-Klick oder
  // Pause-Button) — das war unerwünscht und wurde entfernt.

  const handleConfigChange = useCallback(
    (newConfig: SimConfig) => {
      setConfig(newConfig);
      if (running) updateConfig(newConfig);
    },
    [running, updateConfig]
  );

  const handleReset = useCallback(() => {
    // Always stop simulation first so it never keeps running if anything below throws
    reset(config);
    setCommentaryLines([]);
    // Generate summary after stopping (wrapped so iOS audio errors can't swallow the reset)
    if (history.length >= 2) {
      try {
        const historyForSummary = history.map((h, i) =>
          i === history.length - 1 ? { ...h, genomeProfile: genomeProfile } : h
        );
        const s = generateSummary({
          challengeName: race?.name ?? CHALLENGE_LABEL,
          population: config.population,
          totalGenerations: history.length,
          history: historyForSummary,
        });
        setSummary(s);
        setSummaryProfile(genomeProfile);
        setSummaryGenome(championGenome);
        playVictory();
      } catch {
        // Ignore errors (e.g. iOS AudioContext restrictions)
      }
    }
  }, [reset, config, history, genomeProfile]);

  const handleToggle = useCallback(() => {
    if (running) {
      pause();
    } else {
      playStart();
      start();
    }
  }, [running, pause, start]);

  const handleStart = useCallback(() => {
    playStart();
    start();
  }, [start]);

  const handleMenuClick = useCallback(() => {
    if (running) pause();
    setShowSplash(true);
  }, [running, pause]);

  const handlePreset = useCallback((presetConfig: SimConfig, selectedRace?: RaceInfo) => {
    setConfig(presetConfig);
    setRace(selectedRace ?? null);
    reset(presetConfig);
    setCommentaryLines([]);
    setSummary(null);
  }, [reset]);

  const handleSplashStart = useCallback((presetConfig: SimConfig, selectedRace?: RaceInfo) => {
    setConfig(presetConfig);
    setRace(selectedRace ?? null);
    reset(presetConfig);
    setCommentaryLines([]);
    setSummary(null);
    setShowSplash(false);
    // Auto-start after a brief delay for the spawn animation
    setTimeout(() => start(), 100);
  }, [reset, start]);

  const handleOpenTutorial = useCallback((fromSplash: boolean) => {
    tutorialFromSplash.current = fromSplash;
    setShowTutorial(true);
  }, []);

  const handleTutorialClose = useCallback(() => {
    setShowTutorial(false);
  }, []);

  const handleTutorialFinish = useCallback((presetConfig?: SimConfig, selectedRace?: RaceInfo) => {
    try {
      localStorage.setItem('sailing_dots_tutorial_seen', '1');
    } catch { /* localStorage nicht verfügbar */ }
    setShowTutorial(false);
    if (presetConfig) {
      handleSplashStart(presetConfig, selectedRace);
    }
  }, [handleSplashStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastH = historyLen > 0 ? history[historyLen - 1] : null;

  const sidebar = (
    <>
      <ControlPanel
        config={config}
        onConfigChange={handleConfigChange}
        state={state}
        running={running}
        lastSurvivors={lastH?.survivors ?? 0}
        lastGeneration={lastH?.generation ?? 0}
        lastAvgFitness={lastH?.avgFitness ?? 0}
        perfStats={perfStats as PerfStats | null}
        commentaryLines={commentaryLines}
        speed={speed}
        onSpeedChange={changeSpeed}
        onStart={handleStart}
        onPause={pause}
        onReset={handleReset}
        onPreset={handlePreset}
        championGenome={championGenome}
        onShareGenome={handleShareGenome}
        genomeProfile={genomeProfile}
      />
    </>
  );

  const statsRow = historyLen > 0 ? (
    <div className={isNarrow ? "flex flex-col gap-3" : "flex gap-4"}>
      <StatsGraph
        history={history}
        width={isNarrow ? fullW : Math.floor(canvasSize * 0.44)}
        height={150}
      />
      {genomeProfile && (
        <GenomeGraph
          profile={genomeProfile}
          width={isNarrow ? fullW : Math.floor(canvasSize * 0.54)}
          height={150}
        />
      )}
    </div>
  ) : null;

  if (IS_SCREENSAVER) {
    const presetName = PRESETS[screensaverPresetIdx.current]?.name ?? "";
    // Das Spielfeld ist quadratisch (160×160). Auf einem 16:9-Bildschirm muss
    // das Canvas quadratisch und zentriert bleiben, sonst werden die Boote
    // horizontal gestreckt (cellW ≠ cellH). Ränder in tiefem Meerblau.
    const ssSize = Math.min(windowSize.w, windowSize.h);
    return (
      <div className="fixed inset-0 overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#072134' }}>
        <SimCanvas
          state={state}
          width={ssSize}
          height={ssSize}
          running={running}
          raceName={race?.name}
          raceBrief={race?.description}
        />
        {/* Screen flash for wipeout / victory */}
        {ssFlash && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: ssFlash === 'wipeout' ? 'rgba(239,68,68,0.22)' : 'rgba(16,185,129,0.16)',
              animation: 'ssFlash 1.5s ease-out forwards',
            }}
          />
        )}

        {/* Survival Rate KPI — permanent, centered bottom */}
        {ssBanner && (
          <SsKpi banner={ssBanner} />
        )}

        {/* Bottom bar */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-between items-end px-5 pointer-events-none select-none">
          <div className="text-left">
            <div className="text-[28px] font-mono font-bold text-zinc-700 leading-none tabular-nums">
              {state ? Math.round(state.agentLocations.length / 2).toLocaleString() : "—"}
            </div>
            <div className="text-[9px] text-zinc-700 font-mono uppercase tracking-widest mt-0.5">active agents</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-zinc-600 font-mono">Sailing Dots</div>
            <div className="text-[9px] text-zinc-700 font-mono">{presetName} · Gen {state?.generation ?? 0}</div>
          </div>
        </div>
      </div>
    );
  }

  if (showSplash) {
    return (
      <>
        <SplashScreen onStart={handleSplashStart} onOpenTutorial={() => handleOpenTutorial(true)} />
        {showTutorial && (
          <TutorialWizard
            onClose={handleTutorialClose}
            onFinish={handleTutorialFinish}
            fromSplash={tutorialFromSplash.current}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 flex justify-center">
    <div className="w-full max-w-[1200px]">
      {summary && (
        <MatchSummaryModal
          summary={summary}
          genomeProfile={summaryProfile}
          championGenome={summaryGenome}
          onShareGenome={summaryGenome ? () => {
            const url = genomeShareUrl(summaryGenome);
            navigator.clipboard.writeText(url);
            playShare();
          } : undefined}
          onClose={() => { setSummary(null); setSummaryProfile(null); setSummaryGenome(null); }}
        />
      )}
      {showTutorial && (
        <TutorialWizard
          onClose={handleTutorialClose}
          onFinish={handleTutorialFinish}
          fromSplash={tutorialFromSplash.current}
        />
      )}

      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={handleMenuClick}
          className="flex-shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 p-1.5
                     hover:border-emerald-800 hover:bg-zinc-800/60 transition-colors"
          title="Back to menu"
        >
          <DarwinLogo size={32} />
        </button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sailing Dots</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Evolution under sail — neural networks learn to tack
            <span className="text-zinc-600 ml-2">— Click the canvas to pause</span>
          </p>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => handleOpenTutorial(false)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5
                       text-zinc-500 hover:text-zinc-200 hover:border-zinc-700
                       text-xs font-mono transition-colors"
            title="How does Sailing Dots work?"
          >
            ?
          </button>
        </div>
      </div>

      {isNarrow ? (
        /* --- Mobile / Narrow: single column --- */
        <div className="flex flex-col gap-4 mx-auto" style={{ maxWidth: fullW }}>
          <ChallengeInfo raceName={race?.name} raceDescription={race?.description} />
          <SimCanvas
            state={state}
            width={canvasSize}
            height={canvasSize}
            running={running}
            onToggle={handleToggle}
            raceName={race?.name}
            raceBrief={race?.description}
          />
          <div className="flex flex-col gap-3" style={{ width: fullW }}>
            {sidebar}
          </div>
          {statsRow}
        </div>
      ) : (
        /* --- Desktop: two columns --- */
        <div className="flex gap-5 items-start">
          <div className="flex flex-col gap-4 flex-shrink-0" style={{ width: canvasSize }}>
            <ChallengeInfo raceName={race?.name} raceDescription={race?.description} />
            <SimCanvas
              state={state}
              width={canvasSize}
              height={canvasSize}
              running={running}
              onToggle={handleToggle}
            />
            {statsRow}
          </div>
          <div className="flex flex-col gap-3 flex-shrink-0" style={{ width: sidebarW }}>
            {sidebar}
          </div>
        </div>
      )}
      <div className="mt-6 text-center">
        <a
          href="https://implisense.com/de"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-zinc-700 hover:text-zinc-500 transition-colors"
        >
          Impressum
        </a>
      </div>
    </div>
    </div>
  );
}
