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

  // --- Rookie mistakes (early generations or a struggling fleet) ---
  // Early on the boats sail badly; call out the classic errors so viewers see what
  // they still have to learn. Derived from the consensus genome + finisher rate.
  if (generation >= 1 && (generation <= 4 || rate < 0.08)) {
    const mistake = describeMistakes(generation, rate, genomeProfile?.topConnections ?? []);
    if (mistake) {
      lines.push({ text: mistake, type: 'concern', generation });
    }
  }

  // --- Strategy analysis (human-readable, no technical connection names) ---
  if (genomeProfile && genomeProfile.topConnections.length > 0) {
    // Surface the learned sailing rule every few generations (avoid spamming every gen)
    if (generation > 1 && generation % 5 === 0) {
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

// Maps genome-profile sensor short names to the sailing role they play at the helm.
const SAILING_SENSE: Record<string, string> = {
  WIND_X: 'the wind angle',
  WIND_Y: 'the wind angle',
  TGT_X: 'the bearing to the mark',
  TGT_Y: 'the bearing to the mark',
  TGT_D: 'the distance to the mark',
  OSC: 'an inner tacking rhythm',
  BDIST: 'how close they are to shore',
  OBST: 'the clear water ahead',
  SPD: 'their own boat speed',
  AGE: 'the race clock',
  RND: 'pure gut feeling',
};

function describeMistakes(generation: number, survivalRate: number, conns: ConnectionProfile[]): string | null {
  const sensorConns = conns.filter(c => c.fromType === 'sensor' && c.frequency > 0.3);
  const usesWind = sensorConns.some(c => c.from === 'WIND_X' || c.from === 'WIND_Y');
  const usesTarget = sensorConns.some(c => c.from === 'TGT_X' || c.from === 'TGT_Y' || c.from === 'TGT_D');

  // The very first generations are pure randomness — nothing learned yet.
  if (generation <= 2) {
    return pick([
      `Total chaos out there! Boats spinning in circles, sailing straight into the wind and stalling, drifting the wrong way — nobody has a clue yet.`,
      `Look at this mess — half the fleet points dead upwind and parks in irons, the rest wander off downwind. Pure trial and error.`,
      `Rookie hour: no boat knows where the wind is. They luff, they stall, they circle. This is what evolution looks like before it learns a thing.`,
    ]);
  }

  // No wind awareness = the cardinal sin: stalling head-to-wind in the no-go zone.
  if (!usesWind) {
    if (usesTarget) {
      return pick([
        `Classic blunder: they steer straight at the mark — and when it sits upwind, they sail right into the ±45° no-go zone and stop dead.`,
        `They want the mark so badly they forget the wind exists. Point too high, lose all speed, park in irons. Painful to watch.`,
      ]);
    }
    return pick([
      `Still sailing blind — no feel for the wind, so they keep pinching head-to-wind and stalling in the no-go zone.`,
      `Nobody's tacking yet. They sail in straight lines until they stall into the wind or run out of course. The penny hasn't dropped.`,
    ]);
  }

  // They sense the wind but still botch the helm work.
  if (survivalRate < 0.1) {
    return pick([
      `They can feel the wind now, but the helm work is a shambles — tacking too late, overshooting, pinching until they stall.`,
      `The wind is on their radar, yet they keep oversteering and killing their speed. The instinct is there; the timing is not.`,
    ]);
  }

  return null;
}

function describeStrategy(conns: ConnectionProfile[], survivalRate: number): string | null {
  // Sailing boats only ever steer (TURN_L / TURN_R); the old MV_ check is a leftover
  // from the land-based Darwin's Arena fork and would never match here.
  const hasHelm = conns.some(c => c.toType === 'action');
  if (!hasHelm) return null;

  const sensorConns = conns.filter(c => c.fromType === 'sensor' && c.frequency > 0.3);

  if (sensorConns.length === 0) {
    return pick([
      `No feel for the wind yet — they're working the helm on pure instinct and hoping the breeze cooperates.`,
      `Sailing blind! No dominant sense at the tiller — these boats are guessing their way up the course.`,
    ]);
  }

  // Unique sailing senses, most frequent first
  const senses = [...new Set(sensorConns.map(c => SAILING_SENSE[c.from] ?? humanLabel(c.from, 'sensor')))];
  const usesWind = sensorConns.some(c => c.from === 'WIND_X' || c.from === 'WIND_Y');
  const usesTarget = sensorConns.some(c => c.from === 'TGT_X' || c.from === 'TGT_Y' || c.from === 'TGT_D');
  const usesClock = sensorConns.some(c => c.from === 'OSC');
  const senseStr = senses.slice(0, 3).join(', ');

  // The signature sailing rule: steering off the wind angle = the fleet learned to tack.
  if (usesWind) {
    if (survivalRate > 0.6) {
      return pick([
        `There it is — they're steering off ${senses[0]}! The fleet has learned to tack, zig-zagging upwind instead of stalling head-to-wind.`,
        `Textbook seamanship! Reading the wind angle and throwing the helm over at the right moment — that's how you beat to windward.`,
        usesClock
          ? `Beautiful rhythm out there: wind angle plus an inner clock means clean, regular tacks up the beat.`
          : `They've cracked it — feel the wind, head up or bear away, and never get caught luffing in the ±45° no-go zone.`,
      ]);
    }
    return pick([
      `Progress on the beat: the boats are starting to steer off the wind angle — the first real sign of tacking.`,
      `You can see them feeling for the wind now, trying to point as high as they can without stalling head-to-wind.`,
      usesClock
        ? `An inner rhythm is emerging — rough, early tacks up the course. Not pretty, but it is tacking.`
        : `Early tacking instincts forming: wind angle is on the radar, the helm work just needs polish.`,
    ]);
  }

  // Homing on the mark without strong wind awareness — fine off the wind, fatal upwind.
  if (usesTarget) {
    return pick([
      `They're locked onto ${senses[0]}, steering straight for the mark — fast on a reach, but the no-go zone punishes the greedy.`,
      `Pure mark-hunger: the fleet chases the bearing to the goal and ignores the wind. Works downwind, ruinous on a beat.`,
    ]);
  }

  // Some other dominant sense driving the helm.
  return pick([
    `The helm is being driven by ${senseStr}. Unconventional seamanship, but evolution doesn't read the rulebook.`,
    `Steering mainly off ${senseStr} — not the textbook approach to a beat, but let's see if it floats.`,
  ]);
}
