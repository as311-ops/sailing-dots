import type { AgentInfo } from "../simulation/simulator";
import type { GenomeProfile } from "../simulation/genome-profile";

interface CreatureAvatarProps {
  info?: AgentInfo | null;
  profile?: GenomeProfile | null;
  label?: string;
  compact?: boolean;
}

/**
 * ASCII sailboat visualization that reflects genome traits.
 *
 * Anatomy mapping:
 * - Sail height = neuron count, sail color = responsiveness
 * - Pennant at masthead = wind sense
 * - Diamonds in the sail foot = neurons
 * - Hull width = genome length
 * - Portholes = dominant sensors
 * - Waves = rudder activity (steering vs. drifting)
 */
export default function CreatureAvatar({ info, profile, label, compact = false }: CreatureAvatarProps) {
  const traits = info
    ? traitsFromAgentInfo(info)
    : profile
      ? traitsFromProfile(profile)
      : null;

  if (!traits) return null;

  const lines = buildCreature(traits);

  if (compact) {
    return (
      <pre className="font-mono text-[10px] leading-[13px] select-none">
        {lines.map((line, i) => (
          <div key={i} className={line.anim ?? ''}>
            {line.chars.map((ch, j) => (
              <span key={j} className={ch.color}>{ch.char}</span>
            ))}
          </div>
        ))}
      </pre>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3">
      {label && (
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
          {label}
        </div>
      )}
      <pre className="font-mono text-[11px] leading-[14px] text-center select-none">
        {lines.map((line, i) => (
          <div key={i} className={line.anim ?? ''}>
            {line.chars.map((ch, j) => (
              <span key={j} className={ch.color}>{ch.char}</span>
            ))}
          </div>
        ))}
      </pre>
      {/* Trait tags */}
      <div className="flex flex-wrap gap-1 mt-2 justify-center">
        {traits.tags.map((tag) => (
          <span
            key={tag.text}
            className={`text-[9px] px-1.5 py-0.5 rounded ${tag.color}`}
          >
            {tag.text}
          </span>
        ))}
      </div>

      {/* Anatomy description */}
      <div className="mt-2 pt-2 border-t border-zinc-800 space-y-0.5">
        {describeAnatomy(traits).map((line, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[9px]">
            <span className={line.color}>{line.icon}</span>
            <span className="text-zinc-500">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Types ---

interface ColorChar {
  char: string;
  color: string;
}

interface CreatureLine {
  chars: ColorChar[];
  anim?: string;
}

interface Tag {
  text: string;
  color: string;
}

interface CreatureTraits {
  neuronCount: number;
  genomeLength: number;
  hasLocationSense: boolean;
  hasBoundarySense: boolean;
  hasPopulationSense: boolean;
  hasSignalSense: boolean;
  hasAgeSense: boolean;
  hasBarrierSense: boolean;
  hasRandomSense: boolean;
  movesForward: boolean;
  movesSideways: boolean;
  movesRandom: boolean;
  emitsSignal: boolean;
  responsiveness: number;
  tags: Tag[];
}

// --- Trait extraction ---

function traitsFromAgentInfo(info: AgentInfo): CreatureTraits {
  const sensorNames = new Set(info.sensorValues.filter(s => s.value > 0.1).map(s => s.name));
  const actionNames = new Set(info.connections.filter(c => !c.to.startsWith('N')).map(c => c.to));

  const tags: Tag[] = [];
  if (info.neuronCount >= 4) tags.push({ text: `${info.neuronCount} Neurons`, color: 'bg-violet-900 text-violet-300' });
  if (info.genomeLength >= 30) tags.push({ text: `${info.genomeLength} Genes`, color: 'bg-zinc-800 text-zinc-400' });
  if (info.responsiveness > 0.8) tags.push({ text: 'Responsive', color: 'bg-emerald-900 text-emerald-300' });
  if (info.responsiveness < 0.3) tags.push({ text: 'Sluggish', color: 'bg-amber-900 text-amber-300' });

  return {
    neuronCount: info.neuronCount,
    genomeLength: info.genomeLength,
    hasLocationSense: sensorNames.has('TARGET_REL_X') || sensorNames.has('TARGET_REL_Y') || sensorNames.has('TARGET_DIST'),
    hasBoundarySense: sensorNames.has('BOUNDARY_DIST'),
    hasPopulationSense: sensorNames.has('SPEED'),
    hasSignalSense: sensorNames.has('WIND_REL_X') || sensorNames.has('WIND_REL_Y'),
    hasAgeSense: sensorNames.has('AGE'),
    hasBarrierSense: false,
    hasRandomSense: sensorNames.has('RANDOM'),
    movesForward: true,
    movesSideways: actionNames.has('TURN_LEFT') || actionNames.has('TURN_RIGHT'),
    movesRandom: false,
    emitsSignal: false,
    responsiveness: info.responsiveness,
    tags,
  };
}

function traitsFromProfile(profile: GenomeProfile): CreatureTraits {
  // Only count connections present in >30% of survivors to avoid flicker
  const threshold = 0.3;
  const sensorConns = new Set(profile.topConnections.filter(c => c.fromType === 'sensor' && c.frequency >= threshold).map(c => c.from));
  const actionConns = new Set(profile.topConnections.filter(c => c.toType === 'action' && c.frequency >= threshold).map(c => c.to));

  const tags: Tag[] = [];
  tags.push({ text: `${profile.avgNeuronCount} Neurons`, color: 'bg-violet-900 text-violet-300' });
  tags.push({ text: `${profile.avgGenomeLength} Genes`, color: 'bg-zinc-800 text-zinc-400' });
  if (profile.connectionCount < 200) tags.push({ text: 'Convergent', color: 'bg-cyan-900 text-cyan-300' });
  if (profile.connectionCount > 400) tags.push({ text: 'Diverse', color: 'bg-amber-900 text-amber-300' });

  return {
    neuronCount: Math.round(profile.avgNeuronCount),
    genomeLength: profile.avgGenomeLength,
    hasLocationSense: sensorConns.has('TGT_X') || sensorConns.has('TGT_Y') || sensorConns.has('TGT_D'),
    hasBoundarySense: sensorConns.has('BDIST'),
    hasPopulationSense: sensorConns.has('SPD'),
    hasSignalSense: sensorConns.has('WIND_X') || sensorConns.has('WIND_Y'),
    hasAgeSense: sensorConns.has('AGE'),
    hasBarrierSense: false,
    hasRandomSense: sensorConns.has('RND'),
    movesForward: true,
    movesSideways: actionConns.has('TURN_L') || actionConns.has('TURN_R'),
    movesRandom: false,
    emitsSignal: false,
    responsiveness: 0.5,
    tags,
  };
}

// --- ASCII sailboat builder ---

function buildCreature(t: CreatureTraits): CreatureLine[] {
  const c = (char: string, color: string): ColorChar => ({ char, color });
  const W = 'text-zinc-100';
  const G = 'text-zinc-600';
  const CY = 'text-cyan-400';
  const VL = 'text-violet-400';
  const AM = 'text-amber-400';
  const EM = 'text-emerald-400';
  const YL = 'text-yellow-300';

  const lines: CreatureLine[] = [];

  // --- Windfähnchen am Masttop (Wind-Sinn) ---
  if (t.hasSignalSense) {
    lines.push({ chars: [c('   ', G), c('~', YL), c('  ', G), c('≋', CY)], anim: 'animate-antenna' });
  } else {
    lines.push({ chars: [c('   ', G), c('·', G)] });
  }

  // --- Mast + Segel (Segelgröße = Hirngröße) ---
  const sailRows = Math.min(2 + Math.ceil(t.neuronCount / 3), 5);
  for (let row = 1; row <= sailRows; row++) {
    const isFoot = row === sailRows;
    const inner = isFoot
      ? '_'.repeat(row - 1)
      : ' '.repeat(row - 1);
    const sailColor = t.responsiveness > 0.6 ? EM : t.responsiveness > 0.3 ? AM : G;
    if (isFoot && t.neuronCount > 0) {
      // Neuronen sitzen als ◆ im Segelfuß
      const diamonds = '◆'.repeat(Math.min(t.neuronCount, row));
      lines.push({ chars: [c('   ', G), c('|', W), c(diamonds, VL), c('\\', sailColor)] });
    } else {
      lines.push({ chars: [c('   ', G), c('|', W), c(inner, sailColor), c('\\', sailColor)] });
    }
  }

  // --- Rumpf (Breite = Genomlänge, Bullaugen = Sinne) ---
  const hullWidth = Math.min(Math.floor(t.genomeLength / 8) + 5, 9);
  const portholeCount = Math.min(
    [t.hasLocationSense, t.hasBoundarySense, t.hasPopulationSense, t.hasAgeSense].filter(Boolean).length,
    Math.floor(hullWidth / 2),
  );
  const hullChars: ColorChar[] = [c(' ', G), c('\\', VL)];
  for (let i = 0; i < hullWidth; i++) {
    const isPorthole = i % 2 === 1 && (i - 1) / 2 < portholeCount;
    hullChars.push(isPorthole ? c('◉', CY) : c('_', VL));
  }
  hullChars.push(c('/', VL));
  if (t.hasRandomSense) hullChars.push(c('?', AM));
  lines.push({ chars: hullChars, anim: 'animate-blink' });

  // --- Wellen (Ruder-Aktivität = bewegte See) ---
  const waveWidth = hullWidth + 5;
  const waveChar = t.movesSideways ? '~' : '-';
  lines.push({ chars: [c(waveChar.repeat(waveWidth), CY)], anim: 'animate-legs' });

  return lines;
}

// --- Anatomy description ---

interface AnatomyLine {
  icon: string;
  text: string;
  color: string;
}

function describeAnatomy(t: CreatureTraits): AnatomyLine[] {
  const lines: AnatomyLine[] = [];

  // Senses
  const senses: string[] = [];
  if (t.hasSignalSense) senses.push('Wind');
  if (t.hasLocationSense) senses.push('Target bearing');
  if (t.hasBoundarySense) senses.push('Shore');
  if (t.hasPopulationSense) senses.push('Speed');
  if (t.hasAgeSense) senses.push('Race clock');
  if (t.hasRandomSense) senses.push('Intuition');

  if (senses.length > 0) {
    lines.push({
      icon: '◉',
      text: `Senses: ${senses.join(', ')}`,
      color: 'text-cyan-400',
    });
  }

  // Brain
  lines.push({
    icon: '◆',
    text: `Brain: ${t.neuronCount} neuron${t.neuronCount !== 1 ? 's' : ''} processing ${t.genomeLength} genes`,
    color: 'text-violet-400',
  });

  // Steering
  if (t.movesSideways) {
    lines.push({
      icon: '⛵',
      text: 'Steering: actively works the rudder',
      color: 'text-amber-400',
    });
  } else {
    lines.push({ icon: '·', text: 'Steering: drifts with locked rudder', color: 'text-zinc-600' });
  }

  // Responsiveness
  if (t.responsiveness > 0.7) {
    lines.push({ icon: '⚡', text: 'Highly reactive — acts quickly and decisively', color: 'text-emerald-400' });
  } else if (t.responsiveness < 0.3) {
    lines.push({ icon: '◌', text: 'Deliberate — responds slowly to stimuli', color: 'text-zinc-500' });
  }

  return lines;
}
