// commentary.ts -- Sports-style live commentary for the evolution simulation

import type { GenomeProfile, ConnectionProfile } from './genome-profile';
import { humanLabel, connectionDescription } from './labels';

export interface CommentaryInput {
  generation: number;
  survivors: number;
  population: number;
  diversity: number;
  genomeProfile: GenomeProfile | null;
  prevSurvivors: number;
  prevDiversity: number;
  prevProfile: GenomeProfile | null;
  challengeName: string;
}

export interface CommentaryLine {
  text: string;
  type: 'hype' | 'analysis' | 'concern' | 'milestone';
  generation: number;
}

export function generateCommentary(input: CommentaryInput): CommentaryLine[] {
  const lines: CommentaryLine[] = [];
  const {
    generation, survivors, population, diversity,
    genomeProfile, prevSurvivors, prevDiversity, prevProfile, challengeName,
  } = input;

  const rate = population > 0 ? survivors / population : 0;
  const prevRate = population > 0 ? prevSurvivors / population : 0;
  const rateChange = rate - prevRate;
  const diversityChange = diversity - prevDiversity;

  // --- Generation milestones ---
  if (generation === 1) {
    lines.push({
      text: `Welcome to the ${challengeName} Challenge! ${population} boats are lining up at the start. Who will make it to the goal zone?`,
      type: 'hype',
      generation,
    });
  } else if (generation % 50 === 0) {
    lines.push({
      text: `Generation ${generation}! ${survivors} out of ${population} made it — a finisher rate of ${pct(rate)}.`,
      type: 'milestone',
      generation,
    });
  }

  // --- Survival rate commentary ---
  if (generation > 1) {
    if (rateChange > 0.15) {
      lines.push({
        text: pick([
          `UNBELIEVABLE! The finisher rate is skyrocketing — from ${pct(prevRate)} to ${pct(rate)}! Evolution just shifted into high gear!`,
          `What a leap! ${pct(rate)} survivors! The training is paying off — the boats have learned something crucial!`,
          `BREAKTHROUGH in generation ${generation}! ${survivors} survivors — that's a new record for this population!`,
        ]),
        type: 'hype',
        generation,
      });
    } else if (rateChange > 0.05) {
      lines.push({
        text: pick([
          `Solid improvement! ${pct(rate)} are making it through — the trend is pointing upward.`,
          `The population is getting stronger. ${survivors} survivors, that's ${Math.round(rateChange * population)} more than last generation.`,
        ]),
        type: 'analysis',
        generation,
      });
    } else if (rateChange < -0.1) {
      lines.push({
        text: pick([
          `Ouch! The finisher rate drops to ${pct(rate)}. Were the mutations too aggressive?`,
          `Setback! Only ${survivors} survivors left. This generation just doesn't have it.`,
          `That hurts — down from ${pct(prevRate)} to ${pct(rate)}. Sometimes evolution takes a step backward.`,
        ]),
        type: 'concern',
        generation,
      });
    } else if (survivors === 0) {
      lines.push({
        text: pick([
          `TOTAL WIPEOUT! Zero survivors! The population gets completely reshuffled. Back to square one!`,
          `Complete reset — nobody beat the challenge. Evolution is brutal.`,
        ]),
        type: 'concern',
        generation,
      });
    }
  }

  // --- Strategy analysis (human-readable, no technical connection names) ---
  if (genomeProfile && genomeProfile.topConnections.length > 0) {
    // Describe dominant strategy every generation
    if (generation > 1) {
      const strategy = describeStrategy(genomeProfile.topConnections, rate);
      if (strategy) {
        lines.push({ text: strategy, type: 'analysis', generation });
      }
    }

    // Convergence signal (no technical details)
    if (prevProfile && genomeProfile.connectionCount < prevProfile.connectionCount * 0.7) {
      lines.push({
        text: pick([
          `The playbook is getting tighter! Fewer tricks, more focus. This squad knows what it wants.`,
          `Trimming the fat! The boats are ditching bad habits and doubling down on what works.`,
          `Convergence alert! The population is locking in on a winning formula.`,
        ]),
        type: 'analysis',
        generation,
      });
    }
  }

  // --- Diversity commentary ---
  if (generation > 3) {
    if (diversityChange < -0.1) {
      lines.push({
        text: pick([
          `Genetic diversity is dropping fast. The boats are looking more and more alike — a dominant genome is taking over.`,
          `Monoculture incoming! Diversity falls to ${pct(diversity)}. A winning genome is pushing out the competition.`,
        ]),
        type: 'analysis',
        generation,
      });
    } else if (diversity > 0.8) {
      lines.push({
        text: `Maximum diversity! The population is still trying wildly different strategies. No clear favorite yet.`,
        type: 'analysis',
        generation,
      });
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Match Summary
// ---------------------------------------------------------------------------

export interface SummaryInput {
  challengeName: string;
  population: number;
  totalGenerations: number;
  history: { generation: number; survivors: number; population: number; diversity: number; genomeProfile: GenomeProfile | null }[];
}

export interface MatchSummary {
  headline: string;
  paragraphs: string[];
  strategyExplainer?: string;
  darwinQuote?: string;
}

export function generateSummary(input: SummaryInput): MatchSummary {
  const { challengeName, population, totalGenerations, history } = input;

  if (history.length < 2) {
    return {
      headline: 'Simulation not yet started',
      paragraphs: ['Start the simulation to get a summary.'],
    };
  }

  const first = history[0];
  const last = history[history.length - 1];
  const firstRate = first.survivors / population;
  const lastRate = last.survivors / population;

  // Find best and worst generation
  let bestGen = history[0], worstGen = history[0];
  for (const h of history) {
    if (h.survivors > bestGen.survivors) bestGen = h;
    if (h.survivors < worstGen.survivors) worstGen = h;
  }
  const bestRate = bestGen.survivors / population;
  const worstRate = worstGen.survivors / population;

  // Find biggest jump
  let biggestJump = 0, jumpFrom = 0, jumpTo = 0, jumpGen = 0;
  for (let i = 1; i < history.length; i++) {
    const jump = (history[i].survivors - history[i - 1].survivors) / population;
    if (jump > biggestJump) {
      biggestJump = jump;
      jumpFrom = history[i - 1].survivors;
      jumpTo = history[i].survivors;
      jumpGen = history[i].generation;
    }
  }

  // Count resets (0 survivors)
  const resets = history.filter(h => h.survivors === 0).length;

  // Diversity trend
  const firstDiv = history[0].diversity;
  const lastDiv = last.diversity;

  // Final strategy
  const finalProfile = last.genomeProfile;

  // --- Build headline ---
  let headline: string;
  if (lastRate > 0.7) {
    headline = `Dominant Victory: ${pct(lastRate)} finisher rate after ${totalGenerations} generations!`;
  } else if (lastRate > 0.3) {
    headline = `Solid Result: ${challengeName} Challenge conquered with ${pct(lastRate)}`;
  } else if (lastRate > 0.05) {
    headline = `Tough Fight: Only ${pct(lastRate)} survive the ${challengeName} Challenge`;
  } else if (lastRate > 0) {
    headline = `On the Brink: ${last.survivors} survivors after ${totalGenerations} generations`;
  } else {
    headline = `Total Wreck: The ${challengeName} Challenge remains unbeaten`;
  }

  // --- Build paragraphs ---
  const paras: string[] = [];

  // Opening
  paras.push(
    `${population} boats competed across ${totalGenerations} generations in the ${challengeName} Challenge. ` +
    `The finisher rate started at ${pct(firstRate)} and ended at ${pct(lastRate)} — ` +
    (lastRate > firstRate
      ? `a clear improvement of ${pct(lastRate - firstRate)}.`
      : lastRate < firstRate
        ? `a decline of ${pct(firstRate - lastRate)}.`
        : `no change.`)
  );

  // Key moments
  const moments: string[] = [];
  if (biggestJump > 0.05) {
    moments.push(`The biggest breakthrough came in generation ${jumpGen}, when survivors jumped from ${jumpFrom} to ${jumpTo}.`);
  }
  if (bestGen.generation !== last.generation) {
    moments.push(`The best generation was #${bestGen.generation} with ${bestGen.survivors} survivors (${pct(bestRate)}).`);
  }
  if (worstGen.survivors === 0 && resets > 0) {
    moments.push(`${resets}x the population had to be completely reshuffled — zero survivors, back to square one.`);
  } else if (worstGen.survivors > 0 && worstRate < lastRate * 0.5) {
    moments.push(`The low point was generation ${worstGen.generation} with only ${worstGen.survivors} survivors.`);
  }
  if (moments.length > 0) {
    paras.push(moments.join(' '));
  }

  // Diversity analysis
  if (lastDiv < 0.3 && firstDiv > 0.5) {
    paras.push(`Genetic diversity dropped from ${pct(firstDiv)} to ${pct(lastDiv)}. A dominant genome has taken over — the boats are practically clones.`);
  } else if (lastDiv > 0.7) {
    paras.push(`Diversity remained high at ${pct(lastDiv)}. The population hasn't found a unified formula for success yet.`);
  } else {
    paras.push(`Genetic diversity settled at ${pct(lastDiv)} — a healthy mix of convergence and variation.`);
  }

  // Final strategy
  if (finalProfile && finalProfile.topConnections.length > 0) {
    const topConns = finalProfile.topConnections.slice(0, 3);
    const sensorConns = topConns.filter(c => c.fromType === 'sensor');
    const moveConns = topConns.filter(c => c.toType === 'action' && c.to.startsWith('MV_'));

    const parts: string[] = [];
    if (sensorConns.length > 0) {
      const sNames = sensorConns.map(c => `"${humanLabel(c.from, 'sensor')}"`).join(' and ');
      parts.push(`relies on ${sNames} as senses`);
    }
    if (moveConns.length > 0) {
      const mNames = moveConns.map(c => `"${humanLabel(c.to, 'action')}"`).join(' and ');
      parts.push(`banks on ${mNames}`);
    }

    if (parts.length > 0) {
      paras.push(
        `The winning genome (${finalProfile.avgGenomeLength} genes, ${finalProfile.avgNeuronCount} neurons) ` +
        parts.join(' and ') + '. ' +
        `${finalProfile.connectionCount} distinct connection patterns were observed among the survivors.`
      );
    }
  }

  // Closing
  if (lastRate > 0.5) {
    paras.push(pick([
      `An impressive feat of evolution. The boats have this challenge firmly in hand.`,
      `Darwin would be proud. This population has figured out what it takes.`,
      `Bottom line: Natural selection delivers — ${pct(lastRate)} reliably find the way.`,
    ]));
  } else if (lastRate > 0) {
    paras.push(pick([
      `There's still room to grow. More generations could push the finisher rate even higher.`,
      `Evolution is working — slowly but steadily. Stay tuned!`,
    ]));
  } else {
    paras.push(`This challenge hasn't been cracked yet. Maybe with different parameters?`);
  }

  // --- Strategy explainer (human-readable) ---
  let strategyExplainer: string | undefined;
  if (finalProfile && finalProfile.topConnections.length > 0) {
    const topSensors = [...new Set(
      finalProfile.topConnections
        .filter(c => c.fromType === 'sensor' && c.frequency > 0.3)
        .slice(0, 4)
        .map(c => humanLabel(c.from, 'sensor'))
    )];

    if (topSensors.length > 0) {
      const senseStr = topSensors.join(', ');
      strategyExplainer = pick([
        `The winning boats learned to sense ${senseStr} and navigate toward the goal. They didn't read a manual — they evolved this behavior from pure randomness over ${totalGenerations} generations.`,
        `Here's what the champions figured out: read ${senseStr}, then act on it. No brain, no plan — just ${finalProfile.avgGenomeLength} genes and natural selection doing its thing.`,
        `The secret sauce? Use ${senseStr} as a compass and let the neural network figure out the rest. Simple? Yes. But it took ${totalGenerations} generations of trial, error, and elimination to discover it.`,
      ]);
    } else {
      strategyExplainer = `The survivors evolved a strategy with no dominant sensory input — pure neural pattern matching. Not sophisticated, but effective. Evolution doesn't care about elegance.`;
    }
  }

  // --- Darwin quote ---
  const darwinQuote = lastRate > 0.5
    ? pick([
        `"It is not the strongest of the species that survives, nor the most intelligent that survives. It is the one that is the most adaptable to change." — Well, these little dots just proved me right.`,
        `"There is grandeur in this view of life... from so simple a beginning, endless forms most beautiful have been evolved." — I said that about finches, but I suppose colored pixels count too.`,
        `"A man who dares to waste one hour of time has not discovered the value of life." — These dots wasted zero hours. ${pct(lastRate)} finisher rate. Efficient little creatures.`,
        `"The love for all living creatures is the most noble attribute of man." — Watching ${population} dots fight for survival... yes, I suppose this is what I meant.`,
      ])
    : lastRate > 0
      ? pick([
          `"It is not the strongest that survives..." — In this case, barely anyone survived. But the principle stands! Give them more generations.`,
          `"Great is the power of steady misrepresentation." — These dots have been misrepresenting competence for ${totalGenerations} generations. Marvelous.`,
          `"Ignorance more frequently begets confidence than does knowledge." — These dots are confident. Whether they're competent is... another matter entirely.`,
        ])
      : pick([
          `"I am turned into a sort of machine for observing facts and grinding out conclusions." — My conclusion here? These dots need help.`,
          `"A scientific man ought to have no wishes, no affections — a mere heart of stone." — Even my stone heart feels sorry for these dots.`,
        ]);

  return { headline, paragraphs: paras, strategyExplainer, darwinQuote };
}

// --- Helpers ---

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function connDesc(c: ConnectionProfile): string {
  return connectionDescription(c.from, c.fromType, c.to, c.toType, c.avgWeight);
}

function describeStrategy(conns: ConnectionProfile[], survivalRate: number): string | null {
  const sensorConns = conns.filter(c => c.fromType === 'sensor' && c.frequency > 0.3);
  const hasMovement = conns.some(c => c.toType === 'action' && c.to.startsWith('MV_'));

  if (!hasMovement) return null;

  if (sensorConns.length === 0) {
    return pick([
      `They're just vibing out there — no clear sensory game plan, pure instinct. Bold!`,
      `Pure chaos on the pitch! No dominant sensors — they're navigating blind and hoping for the best.`,
    ]);
  }

  // Describe what they sense (this is always accurate, unlike movement direction)
  const senseNames = [...new Set(sensorConns.slice(0, 3).map(c => humanLabel(c.from, 'sensor')))];
  const senseStr = senseNames.join(' and ');
  const senseCount = sensorConns.length;

  if (survivalRate > 0.7) {
    return pick([
      `WHAT A PLAY! The squad is locked in on "${senseStr}" — reading the field and navigating like pros!`,
      `This is textbook evolution! "${senseStr}" is their compass and ${pct(survivalRate)} are reaching the goal. The crowd goes wild!`,
      `They've cracked the code! Sense "${senseStr}", then move with purpose. Championship-level instincts!`,
      `Unstoppable! ${senseCount} active senses driving the population — "${senseStr}" leading the charge. Pure class!`,
    ]);
  }

  if (survivalRate > 0.3) {
    return pick([
      `The playbook: read "${senseStr}" and navigate accordingly. Decent formation, getting there!`,
      `"${senseStr}" is the radar of choice — the squad is finding its rhythm. Not bad, not bad!`,
      `Coach Evolution has the team tuned into "${senseStr}". Let's see if it pays off!`,
      `Interesting tactical read! "${senseStr}" as the guiding instinct. ${pct(survivalRate)} making it through.`,
    ]);
  }

  return pick([
    `They're tuning into "${senseStr}" but can't quite translate it into results yet. Needs work!`,
    `The senses are there — "${senseStr}" — but the execution is shaky. Back to the training ground!`,
    `"${senseStr}" is on the radar, but these boats need more reps to figure it out!`,
    `Reading "${senseStr}"... on paper it's a plan, on the field it's chaos. Classic early-season form!`,
  ]);
}
