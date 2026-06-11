import type { AgentInfo } from "../simulation/simulator";
import { humanLabel } from "../simulation/labels";
import CreatureAvatar from "./CreatureAvatar";

interface AgentInspectorProps {
  info: AgentInfo | null;
  onClose: () => void;
}

const DIR_NAMES = ['SW', 'S', 'SE', 'W', 'C', 'E', 'NW', 'N', 'NE'];

export default function AgentInspector({ info, onClose }: AgentInspectorProps) {
  if (!info) return null;

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 space-y-3 text-xs w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-zinc-100 font-semibold text-sm">
            {info.name}
          </span>
          <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
            {info.clan}
          </span>
          <span className="text-zinc-600 text-[10px]">
            #{info.index}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 text-sm leading-none px-1"
        >
          x
        </button>
      </div>

      {/* Creature avatar */}
      <CreatureAvatar info={info} />

      {/* Basic stats */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Position" value={`${info.x}, ${info.y}`} />
        <Stat label="Age" value={String(info.age)} />
        <Stat label="Heading" value={DIR_NAMES[info.heading] ?? '?'} />
        <Stat label="Genome" value={`${info.genomeLength} genes`} />
        <Stat label="Neurons" value={String(info.neuronCount)} />
        <Stat label="Conn." value={String(info.connectionCount)} />
      </div>

      {/* Sensor values — single column, full width */}
      <div>
        <div className="text-zinc-500 uppercase tracking-wider text-[10px] mb-1.5">
          Sensors
        </div>
        <div className="space-y-px max-h-44 overflow-y-auto">
          {info.sensorValues.map((s) => (
            <div key={s.name} className="flex items-center gap-2 h-5">
              <span className="text-zinc-400 text-[10px] w-28 flex-shrink-0">
                {humanLabel(s.name, 'sensor')}
              </span>
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.round(s.value * 100)}%` }}
                />
              </div>
              <span className="text-zinc-500 font-mono text-[10px] w-8 text-right flex-shrink-0">
                {s.value.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Neural net connections */}
      <div>
        <div className="text-zinc-500 uppercase tracking-wider text-[10px] mb-1.5">
          Neural Network ({info.connectionCount} Conn.)
        </div>
        <div className="max-h-36 overflow-y-auto space-y-0.5">
          {info.connections.map((c, i) => {
            const isFromNeuron = c.from.startsWith('N');
            const isToNeuron = c.to.startsWith('N');
            return (
              <div key={i} className="flex items-center gap-1 text-[10px] h-4">
                <span className={`flex-shrink-0 ${isFromNeuron ? 'text-violet-400' : 'text-cyan-400'}`}>
                  {humanLabel(c.from, isFromNeuron ? 'neuron' : 'sensor')}
                </span>
                <span className="text-zinc-600 flex-shrink-0">→</span>
                <span className={`flex-shrink-0 ${isToNeuron ? 'text-violet-400' : 'text-amber-400'}`}>
                  {humanLabel(c.to, isToNeuron ? 'neuron' : 'action')}
                </span>
                <div className="flex-1" />
                <WeightBar weight={c.weight} />
                <span className="text-zinc-500 font-mono w-10 text-right flex-shrink-0">
                  {c.weight >= 0 ? '+' : ''}{c.weight}
                </span>
              </div>
            );
          })}
          {info.connections.length === 0 && (
            <div className="text-zinc-600 italic">No connections</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-zinc-600 text-[10px]">{label}</div>
      <div className="text-zinc-200 font-mono">{value}</div>
    </div>
  );
}

function WeightBar({ weight }: { weight: number }) {
  const absW = Math.min(Math.abs(weight), 4);
  const pct = (absW / 4) * 100;
  const color = weight >= 0 ? 'bg-emerald-500' : 'bg-red-500';
  return (
    <div className="w-6 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex-shrink-0">
      <div
        className={`h-full ${color} rounded-full`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
