import { useState } from "react";
import { createPortal } from "react-dom";
import type { SimConfig } from "./ControlPanel";
import { DEFAULT_CONFIG } from "./ControlPanel";
import { PRESETS } from "./Presets";

interface TutorialWizardProps {
  onClose: () => void;
  onFinish: (startConfig?: SimConfig) => void;
  fromSplash: boolean;
}

const STEPS = [
  {
    subtitle: "WHAT IS THIS?",
    title: "Sailing Dots",
    body: "A living evolution experiment at sea. Hundreds of little sailboats — each with a neural network brain — race to a target zone. Over generations only the fastest pass on their genes. You are watching boats learn to sail, in real time, with no sailing knowledge programmed in.",
    visual: (
      <pre className="font-mono text-[13px] leading-[16px] select-none text-center">
        <span className="text-cyan-400">{"      ~  "}</span>
        <span className="text-zinc-500">{"≋"}</span>
        {"\n"}
        <span className="text-zinc-100">{"      |"}</span>
        <span className="text-emerald-400">{"\\"}</span>
        {"\n"}
        <span className="text-zinc-100">{"      |"}</span>
        <span className="text-emerald-400">{" \\"}</span>
        {"\n"}
        <span className="text-zinc-100">{"      |"}</span>
        <span className="text-emerald-400">{"  \\"}</span>
        {"\n"}
        <span className="text-zinc-100">{"      |"}</span>
        <span className="text-emerald-400">{"___\\"}</span>
        {"\n"}
        <span className="text-violet-400">{"  \\___________/"}</span>
        {"\n"}
        <span className="text-cyan-400">{"~~~~~~~~~~~~~~~~~~~"}</span>
      </pre>
    ),
  },
  {
    subtitle: "THE PLAYERS",
    title: "Sailing Dots",
    body: "Each boat is an autonomous agent on a 2D sea. It senses the wind and the target bearing, processes the inputs through a neural network, and steers its rudder every simulation step. No hard-coded rules — all behavior emerges from evolved genes.",
    visual: (
      <svg width="240" height="90" viewBox="0 0 240 90" className="mx-auto">
        <circle cx="60" cy="45" r="14" fill="#10b981" opacity="0.9" />
        <text x="60" y="49" textAnchor="middle" fontSize="10" fill="white">🦠</text>
        <line x1="10" y1="25" x2="46" y2="39" stroke="#06b6d4" strokeWidth="1.5" markerEnd="url(#arr-in)" />
        <line x1="10" y1="45" x2="46" y2="45" stroke="#06b6d4" strokeWidth="1.5" markerEnd="url(#arr-in)" />
        <line x1="10" y1="65" x2="46" y2="51" stroke="#06b6d4" strokeWidth="1.5" markerEnd="url(#arr-in)" />
        <text x="2" y="23" fontSize="8" fill="#06b6d4">👁</text>
        <text x="2" y="43" fontSize="8" fill="#06b6d4">📡</text>
        <text x="2" y="63" fontSize="8" fill="#06b6d4">🧭</text>
        <circle cx="120" cy="30" r="10" fill="#7c3aed" opacity="0.7" />
        <circle cx="120" cy="60" r="10" fill="#7c3aed" opacity="0.7" />
        <line x1="74" y1="41" x2="110" y2="34" stroke="#a78bfa" strokeWidth="1" strokeDasharray="3,2" />
        <line x1="74" y1="49" x2="110" y2="56" stroke="#a78bfa" strokeWidth="1" strokeDasharray="3,2" />
        <circle cx="190" cy="45" r="14" fill="#f59e0b" opacity="0.9" />
        <text x="190" y="49" textAnchor="middle" fontSize="10" fill="white">🦠</text>
        <line x1="130" y1="34" x2="176" y2="41" stroke="#fbbf24" strokeWidth="1.5" markerEnd="url(#arr-out)" />
        <line x1="130" y1="56" x2="176" y2="49" stroke="#fbbf24" strokeWidth="1.5" markerEnd="url(#arr-out)" />
        <line x1="204" y1="39" x2="230" y2="28" stroke="#fbbf24" strokeWidth="1.5" markerEnd="url(#arr-out)" />
        <line x1="204" y1="51" x2="230" y2="62" stroke="#fbbf24" strokeWidth="1.5" markerEnd="url(#arr-out)" />
        <text x="226" y="26" fontSize="8" fill="#fbbf24">↑</text>
        <text x="226" y="60" fontSize="8" fill="#fbbf24">↓</text>
        <defs>
          <marker id="arr-in" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#06b6d4" />
          </marker>
          <marker id="arr-out" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#fbbf24" />
          </marker>
        </defs>
        <text x="50" y="84" fontSize="8" fill="#6b7280" textAnchor="middle">Sensors</text>
        <text x="120" y="84" fontSize="8" fill="#6b7280" textAnchor="middle">Neurons</text>
        <text x="190" y="84" fontSize="8" fill="#6b7280" textAnchor="middle">Actions</text>
      </svg>
    ),
  },
  {
    subtitle: "THE BLUEPRINT",
    title: "Genome & Genes",
    body: "Every boat carries a genome: a sequence of genes. Each gene encodes one connection — a Source (sensor or neuron), a Weight (how strongly it influences), and a Sink (neuron or action). The genome is the boat's complete brain wiring diagram, packed as a list of 32-bit integers.",
    visual: (
      <div className="font-mono text-[11px] leading-relaxed text-center space-y-1">
        <div className="text-zinc-500 mb-2">One gene = one synaptic connection</div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 rounded px-2 py-1">
            SOURCE<br /><span className="text-[9px] text-cyan-500">Sensor / Neuron</span>
          </span>
          <div className="text-center">
            <div className="text-emerald-400 font-bold">+2.4</div>
            <div className="text-zinc-600 text-[9px]">Weight</div>
            <div className="text-zinc-700">──→</div>
          </div>
          <span className="bg-violet-950/60 border border-violet-800/40 text-violet-300 rounded px-2 py-1">
            SINK<br /><span className="text-[9px] text-violet-500">Neuron / Action</span>
          </span>
        </div>
        <div className="text-zinc-600 text-[9px] mt-3">
          Genomes with 4–64 genes · up to 20 neurons
        </div>
      </div>
    ),
  },
  {
    subtitle: "PERCEPTION",
    title: "What a Boat Senses",
    body: "Each boat reads 10 sensor channels, all normalized to 0.0–1.0. The crucial ones: the wind angle relative to its own heading (am I in the no-go zone?) and the bearing to the target. Genes wire these inputs into the brain — combining them correctly is what evolution must discover.",
    visual: (
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        {[
          { label: "WIND_REL_X/Y", desc: "Wind angle vs. heading", color: "text-cyan-300 bg-cyan-950/60 border-cyan-800/40" },
          { label: "TARGET_REL_X/Y", desc: "Bearing to target", color: "text-emerald-300 bg-emerald-950/60 border-emerald-800/40" },
          { label: "TARGET_DIST", desc: "Distance to target", color: "text-violet-300 bg-violet-950/60 border-violet-800/40" },
          { label: "SPEED", desc: "Am I making progress?", color: "text-orange-300 bg-orange-950/60 border-orange-800/40" },
          { label: "BOUNDARY_DIST", desc: "Shore proximity", color: "text-yellow-300 bg-yellow-950/60 border-yellow-800/40" },
          { label: "RANDOM / OSC1", desc: "Internal / Random", color: "text-zinc-300 bg-zinc-800/60 border-zinc-700/40" },
        ].map(s => (
          <div key={s.label} className={`rounded border px-2 py-1 ${s.color}`}>
            <div className="font-mono font-semibold">{s.label}</div>
            <div className="text-[9px] opacity-70">{s.desc}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    subtitle: "BEHAVIOR",
    title: "Steering Is Everything",
    body: "A boat only controls its rudder: turn 45° to port or starboard. It always sails forward — but its speed depends on the angle to the wind. Sailing straight into the wind means standing still (the no-go zone). The fastest course is across the wind. To reach an upwind target, boats must learn to tack in zigzags.",
    visual: (
      <div className="grid grid-cols-3 gap-1 text-[9px]">
        {[
          { icon: "↰", label: "Turn Left", color: "text-emerald-400" },
          { icon: "↱", label: "Turn Right", color: "text-emerald-400" },
          { icon: "⛵", label: "Auto-Sail", color: "text-cyan-400" },
          { icon: "🚫", label: "No-Go: 5%", color: "text-red-400" },
          { icon: "↗", label: "Close-Hauled: 50%", color: "text-amber-400" },
          { icon: "→", label: "Beam Reach: 100%", color: "text-emerald-400" },
          { icon: "↘", label: "Broad Reach: 90%", color: "text-emerald-400" },
          { icon: "↓", label: "Running: 70%", color: "text-cyan-400" },
          { icon: "⚡", label: "Speed = Polar", color: "text-violet-400" },
        ].map(a => (
          <div key={a.label} className="bg-zinc-800/70 rounded px-1.5 py-1 text-center">
            <div className={`text-base leading-tight ${a.color}`}>{a.icon}</div>
            <div className="text-zinc-500 mt-0.5">{a.label}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    subtitle: "THE ENGINE",
    title: "How Evolution Works",
    body: "Each generation is one race: the fleet lines up behind the start line, and whoever crosses the finish gate between the buoys earliest scores highest — getting close earns a small consolation. The best scores become parents: their genomes are copied, crossed over, and mutated for the next race. Over hundreds of generations, sailing skill spreads through the fleet.",
    visual: (
      <div className="flex items-center justify-center gap-1 flex-wrap text-[9px]">
        {[
          { label: "Run Gen N", color: "text-zinc-300 bg-zinc-800" },
          { label: "→", color: "text-zinc-600" },
          { label: "Score\nFitness", color: "text-amber-300 bg-amber-950/60" },
          { label: "→", color: "text-zinc-600" },
          { label: "Select\nParents", color: "text-emerald-300 bg-emerald-950/60" },
          { label: "→", color: "text-zinc-600" },
          { label: "Mutate &\nCross", color: "text-violet-300 bg-violet-950/60" },
          { label: "→", color: "text-zinc-600" },
          { label: "Gen N+1", color: "text-zinc-300 bg-zinc-800" },
        ].map((node, i) =>
          node.label === "→" ? (
            <span key={i} className="text-zinc-600 font-mono">{node.label}</span>
          ) : (
            <span key={i} className={`rounded px-2 py-1 border border-zinc-700/40 whitespace-pre-line text-center ${node.color}`}>
              {node.label}
            </span>
          )
        )}
      </div>
    ),
  },
  {
    subtitle: "THE RULES",
    title: "The Wind Decides",
    body: "The finish gate sits in one quadrant of the sea, the wind blows from one of 8 directions. A downwind gate is easy — just run with the wind. An upwind gate demands tacking, and the narrow gate funnels the whole fleet through one bottleneck. The wind shifts over the generations: genomes that memorized compass directions collapse, genomes that navigate relative to the wind keep winning.",
    visual: (
      <div className="grid grid-cols-2 gap-1.5 text-[9px]">
        {[
          { name: "Fixed Wind", desc: "Learn one wind, master it" },
          { name: "Rotating Wind", desc: "45° shift every N generations" },
          { name: "Random Wind", desc: "New direction every race" },
          { name: "Downwind Target", desc: "Easy: run with the wind" },
          { name: "Upwind Target", desc: "Hard: tack in zigzags" },
          { name: "Random Target", desc: "A new quadrant every race" },
        ].map(c => (
          <div key={c.name} className="bg-zinc-800/60 rounded border border-zinc-700/30 px-2 py-1.5">
            <div className="text-emerald-400 font-semibold">{c.name}</div>
            <div className="text-zinc-500">{c.desc}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    subtitle: "READY",
    title: "Ready to Set Sail?",
    body: "Pick a race and hit Start. Watch generation 0 — boats spinning in circles, stuck in irons. Then watch the fleet learn to sail. The simulation never cheats: no sailing knowledge is hand-coded into any boat. Every tack you see was discovered by evolution itself.",
    visual: (
      <div className="animate-pulse">
        <pre className="font-mono text-[13px] leading-[16px] select-none text-center">
          <span className="text-cyan-400">{"      ~  "}</span>
          <span className="text-zinc-500">{"≋"}</span>
          {"\n"}
          <span className="text-zinc-100">{"      |"}</span>
          <span className="text-emerald-400">{"\\"}</span>
          {"\n"}
          <span className="text-zinc-100">{"      |"}</span>
          <span className="text-emerald-400">{" \\"}</span>
          {"\n"}
          <span className="text-zinc-100">{"      |"}</span>
          <span className="text-emerald-400">{"  \\"}</span>
          {"\n"}
          <span className="text-zinc-100">{"      |"}</span>
          <span className="text-emerald-400">{"___\\"}</span>
          {"\n"}
          <span className="text-violet-400">{"  \\___________/"}</span>
          {"\n"}
          <span className="text-cyan-400">{"~~~~~~~~~~~~~~~~~~~"}</span>
        </pre>
      </div>
    ),
  },
];

export default function TutorialWizard({ onClose, onFinish, fromSplash }: TutorialWizardProps) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  const handleFinish = () => {
    if (fromSplash) {
      const quickStart = PRESETS[0];
      onFinish({ ...DEFAULT_CONFIG, ...quickStart.config });
    } else {
      onFinish();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-xl w-full flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-700 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
              Tutorial
            </span>
            <span className="text-[10px] text-zinc-500">
              Step {step + 1} of {total}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg leading-none px-1"
            title="Close tutorial"
          >
            ×
          </button>
        </div>

        {/* Visual area */}
        <div
          key={step}
          className="mx-5 mt-4 bg-zinc-800/30 rounded-lg px-4 py-4 flex items-center justify-center min-h-[130px]"
          style={{ animation: "var(--animate-tutorial-step)" }}
        >
          {current.visual}
        </div>

        {/* Text content */}
        <div
          key={`text-${step}`}
          className="px-5 pt-4 pb-2"
          style={{ animation: "var(--animate-tutorial-step)" }}
        >
          <div className="text-[10px] text-emerald-500 uppercase tracking-widest mb-1">
            {current.subtitle}
          </div>
          <h2 className="text-lg font-semibold text-zinc-100">{current.title}</h2>
          <p className="text-sm text-zinc-400 leading-relaxed mt-2">{current.body}</p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between mt-2">
          <button
            onClick={onClose}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Skip
          </button>

          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === step ? "bg-emerald-500" : "bg-zinc-700 hover:bg-zinc-500"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                ← Back
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded transition-colors"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded transition-colors"
              >
                {fromSplash ? "Start Evolving →" : "Done ✓"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
