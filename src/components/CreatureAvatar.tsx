import type { AgentInfo } from "../simulation/simulator";
import type { GenomeProfile } from "../simulation/genome-profile";

interface CreatureAvatarProps {
  info?: AgentInfo | null;
  profile?: GenomeProfile | null;
  label?: string;
  compact?: boolean;
}

/**
 * ASCII creature visualization that reflects genome traits.
 *
 * Anatomy mapping:
 * - Head size = neuron count
 * - Eyes = dominant sensors (what the creature "sees")
 * - Antennae = signal/pheromone sensors
 * - Body width = genome length
 * - Legs/movement = dominant action type
 * - Tail/emission = signal emission
 * - Posture = responsiveness
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

// --- ASCII creature builder ---

function buildCreature(t: CreatureTraits): CreatureLine[] {
  const c = (char: string, color: string): ColorChar => ({ char, color });
  const W = 'text-zinc-100';
  const G = 'text-zinc-600';
  const CY = 'text-cyan-400';
  const VL = 'text-violet-400';
  const AM = 'text-amber-400';
  const EM = 'text-emerald-400';
  const RD = 'text-red-400';
  const YL = 'text-yellow-300';

  const lines: CreatureLine[] = [];

  // --- Antennae (signal/barrier sensors) ---
  if (t.hasSignalSense || t.hasBarrierSense) {
    const left = t.hasSignalSense ? [c('~', YL), c('\\', G)] : [c(' ', G), c(' ', G)];
    const right = t.hasBarrierSense ? [c('/', G), c('!', RD)] : [c(' ', G), c(' ', G)];
    lines.push({ chars: [c('  ', G), ...left, c('  ', G), ...right, c(' ', G)], anim: 'animate-antenna' });
  }

  // --- Emission cloud ---
  if (t.emitsSignal) {
    lines.push({ chars: [c('    ', G), c('░░░', YL), c('   ', G)] });
  }

  // --- Eyes (sensors) ---
  const eyeCount = [t.hasLocationSense, t.hasBoundarySense, t.hasPopulationSense, t.hasAgeSense].filter(Boolean).length;
  let eyes: ColorChar[];
  if (eyeCount >= 3) {
    eyes = [c(' ', G), c('◉', CY), c('◉', CY), c('◉', CY), c(' ', G)];
  } else if (eyeCount >= 2) {
    eyes = [c(' ', G), c(' ◉', CY), c(' ', G), c('◉ ', CY), c(' ', G)];
  } else {
    eyes = [c(' ', G), c(' ', G), c('◉', CY), c(' ', G), c(' ', G)];
  }
  if (t.hasRandomSense) {
    eyes.push(c('?', AM));
  }
  lines.push({ chars: eyes, anim: 'animate-blink' });

  // --- Head (neuron count) ---
  const headWidth = Math.min(t.neuronCount + 2, 8);
  const headChars = '█'.repeat(headWidth);
  const headPad = ' '.repeat(Math.max(0, Math.floor((9 - headWidth) / 2)));
  lines.push({ chars: [c(headPad, G), c('╔', VL), c(headChars, VL), c('╗', VL)] });

  // --- Brain (neuron details) ---
  const brainSymbols = '◆'.repeat(Math.min(t.neuronCount, 6));
  const brainPad = ' '.repeat(Math.max(0, Math.floor((headWidth - t.neuronCount) / 2)));
  lines.push({ chars: [c(headPad, G), c('║', VL), c(brainPad, G), c(brainSymbols, VL), c(brainPad.length > 0 ? brainPad : ' ', G), c('║', VL)] });
  lines.push({ chars: [c(headPad, G), c('╚', VL), c('═'.repeat(headWidth), VL), c('╝', VL)] });

  // --- Body (genome length) ---
  const bodyWidth = Math.min(Math.floor(t.genomeLength / 6) + 2, 7);
  const bodyPad = ' '.repeat(Math.max(0, Math.floor((9 - bodyWidth) / 2)));
  const bodyChar = t.responsiveness > 0.6 ? '▓' : t.responsiveness > 0.3 ? '▒' : '░';
  lines.push({ chars: [c(bodyPad, G), c(' ', G), c(bodyChar.repeat(bodyWidth), EM), c(' ', G)] });
  lines.push({ chars: [c(bodyPad, G), c(' ', G), c(bodyChar.repeat(bodyWidth), EM), c(' ', G)] });

  // --- Legs/movement ---
  const legPad = ' '.repeat(Math.max(0, Math.floor((9 - bodyWidth) / 2)));
  if (t.movesForward) {
    lines.push({ chars: [c(legPad, G), c(' ╿', W), c(' '.repeat(Math.max(1, bodyWidth - 2)), G), c('╿ ', W)], anim: 'animate-legs' });
    lines.push({ chars: [c(legPad, G), c(' │', W), c(' '.repeat(Math.max(1, bodyWidth - 2)), G), c('│ ', W)], anim: 'animate-legs' });
  } else if (t.movesSideways) {
    lines.push({ chars: [c(legPad, G), c('╾', AM), c('─'.repeat(bodyWidth), AM), c('╼', AM)], anim: 'animate-legs' });
  } else if (t.movesRandom) {
    lines.push({ chars: [c(legPad, G), c(' ╱', W), c(' '.repeat(Math.max(1, bodyWidth - 2)), G), c('╲ ', W)], anim: 'animate-legs' });
    lines.push({ chars: [c(legPad, G), c('╱', W), c(' '.repeat(Math.max(1, bodyWidth)), G), c('╲', W)], anim: 'animate-legs' });
  } else {
    lines.push({ chars: [c(legPad, G), c(' ╵', G), c(' '.repeat(Math.max(1, bodyWidth - 2)), G), c('╵ ', G)] });
  }

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
  if (t.hasLocationSense) senses.push('Location');
  if (t.hasBoundarySense) senses.push('Boundary');
  if (t.hasPopulationSense) senses.push('Population');
  if (t.hasBarrierSense) senses.push('Barriers');
  if (t.hasAgeSense) senses.push('Age');
  if (t.hasSignalSense) senses.push('Scent');
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

  // Movement
  const moves: string[] = [];
  if (t.movesForward) moves.push('Forward');
  if (t.movesSideways) moves.push('Sideways');
  if (t.movesRandom) moves.push('Random');
  if (moves.length > 0) {
    lines.push({
      icon: '↗',
      text: `Movement: ${moves.join(', ')}`,
      color: 'text-amber-400',
    });
  } else {
    lines.push({ icon: '·', text: 'Movement: No dominant direction', color: 'text-zinc-600' });
  }

  // Special abilities
  if (t.emitsSignal) {
    lines.push({ icon: '~', text: 'Leaves scent trails for nearby creatures', color: 'text-yellow-300' });
  }

  // Responsiveness
  if (t.responsiveness > 0.7) {
    lines.push({ icon: '⚡', text: 'Highly reactive — acts quickly and decisively', color: 'text-emerald-400' });
  } else if (t.responsiveness < 0.3) {
    lines.push({ icon: '◌', text: 'Deliberate — responds slowly to stimuli', color: 'text-zinc-500' });
  }

  return lines;
}
