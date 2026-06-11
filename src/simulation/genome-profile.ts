// genome-profile.ts -- Compute consensus genome profile from survivors
// Shows which sensor→neuron→action pathways are most common

import { Genome, Gene, Sensor, Action } from './types';
import { createWiringFromGenome, type WiringParams } from './neural-net';

export interface ConnectionProfile {
  from: string;
  fromType: 'sensor' | 'neuron';
  to: string;
  toType: 'neuron' | 'action';
  frequency: number;   // 0..1 — fraction of survivors with this connection
  avgWeight: number;    // average weight across survivors
}

export interface GenomeProfile {
  connectionCount: number;
  topConnections: ConnectionProfile[];
  avgGenomeLength: number;
  avgNeuronCount: number;
}

const SENSOR_NAMES = [
  'WIND_X', 'WIND_Y', 'TGT_X', 'TGT_Y',
  'TGT_D', 'BDIST', 'SPD', 'OSC',
  'AGE', 'RND', 'OBST',
];

const ACTION_NAMES = ['TURN_L', 'TURN_R'];

export function computeGenomeProfile(
  genomes: Genome[],
  params: WiringParams,
  maxConnections: number = 16,
): GenomeProfile {
  if (genomes.length === 0) {
    return { connectionCount: 0, topConnections: [], avgGenomeLength: 0, avgNeuronCount: 0 };
  }

  // Count connection frequency and accumulate weights
  // Key: "fromType:fromNum->toType:toNum"
  const connMap = new Map<string, { count: number; weightSum: number }>();

  let totalGenomeLen = 0;
  let totalNeurons = 0;

  // Sample up to 30 survivors to keep it fast
  const sampleSize = Math.min(genomes.length, 30);
  const step = Math.max(1, Math.floor(genomes.length / sampleSize));

  let sampled = 0;
  for (let i = 0; i < genomes.length && sampled < sampleSize; i += step) {
    const genome = genomes[i];
    totalGenomeLen += genome.length;

    const nnet = createWiringFromGenome(genome, params);
    totalNeurons += nnet.neurons.length;

    for (const conn of nnet.connections) {
      const fromName = conn.sourceType === 1
        ? SENSOR_NAMES[conn.sourceNum] ?? `S${conn.sourceNum}`
        : `N${conn.sourceNum}`;
      const toName = conn.sinkType === 1
        ? ACTION_NAMES[conn.sinkNum] ?? `A${conn.sinkNum}`
        : `N${conn.sinkNum}`;
      const key = `${conn.sourceType}:${conn.sourceNum}->${conn.sinkType}:${conn.sinkNum}`;

      const entry = connMap.get(key);
      const w = conn.weight / 8192;
      if (entry) {
        entry.count++;
        entry.weightSum += w;
      } else {
        connMap.set(key, { count: 1, weightSum: w });
      }
    }
    sampled++;
  }

  // Convert to sorted array
  const allConns: ConnectionProfile[] = [];
  for (const [key, val] of connMap) {
    const [fromPart, toPart] = key.split('->');
    const [fromTypeStr, fromNumStr] = fromPart.split(':');
    const [toTypeStr, toNumStr] = toPart.split(':');
    const fromNum = parseInt(fromNumStr);
    const toNum = parseInt(toNumStr);

    const fromName = fromTypeStr === '1'
      ? SENSOR_NAMES[fromNum] ?? `S${fromNum}`
      : `N${fromNum}`;
    const toName = toTypeStr === '1'
      ? ACTION_NAMES[toNum] ?? `A${toNum}`
      : `N${toNum}`;

    allConns.push({
      from: fromName,
      fromType: fromTypeStr === '1' ? 'sensor' : 'neuron',
      to: toName,
      toType: toTypeStr === '1' ? 'action' : 'neuron',
      frequency: val.count / sampled,
      avgWeight: val.weightSum / val.count,
    });
  }

  // Sort by frequency (most common first)
  allConns.sort((a, b) => b.frequency - a.frequency);

  return {
    connectionCount: allConns.length,
    topConnections: allConns.slice(0, maxConnections),
    avgGenomeLength: Math.round(totalGenomeLen / sampled),
    avgNeuronCount: Math.round((totalNeurons / sampled) * 10) / 10,
  };
}
