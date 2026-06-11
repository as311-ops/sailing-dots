// lineage.ts -- Champion lineage tracking across generations

import { type Genome, Sensor, Action } from './types';
import { createWiringFromGenome } from './neural-net';
import { nameFromGenome } from './naming';

export interface ChampionSnapshot {
  generation: number;
  name: string;
  genome: Genome;
  neuronCount: number;
  genomeLength: number;
  responsiveness: number;
  score: number;
  // Trait flags derived from the neural net
  sensors: string[];   // active sensor short names
  actions: string[];   // active action short names
}

/**
 * Create a snapshot of the best survivor (champion) from a generation.
 * Called from spawnNewGeneration with the highest-scoring candidate.
 */
export function createChampionSnapshot(
  genome: Genome,
  score: number,
  generation: number,
  maxNumberNeurons: number,
): ChampionSnapshot {
  const wiringParams = {
    maxNumberNeurons,
    numSenses: Sensor.NUM_SENSES,
    numActions: Action.NUM_ACTIONS,
  };
  const nnet = createWiringFromGenome(genome, wiringParams);

  // Determine active sensors and actions from connections
  // sourceType: 0=NEURON, 1=SENSOR; sinkType: 0=NEURON, 1=ACTION
  const sensorSet = new Set<string>();
  const actionSet = new Set<string>();
  for (const conn of nnet.connections) {
    if (conn.sourceType === 1) { // sensor
      sensorSet.add(sensorShortName(conn.sourceNum));
    }
    if (conn.sinkType === 1) { // action
      actionSet.add(actionShortName(conn.sinkNum));
    }
  }

  return {
    generation,
    name: nameFromGenome(genome),
    genome: genome.slice(), // defensive copy
    neuronCount: nnet.neurons.length,
    genomeLength: genome.length,
    responsiveness: 0.5, // default, we don't have the indiv's actual value here
    score,
    sensors: [...sensorSet],
    actions: [...actionSet],
  };
}

// Match names from genome-profile.ts for consistency
const SENSOR_NAMES: Record<number, string> = {
  0: 'WIND_X', 1: 'WIND_Y', 2: 'TGT_X', 3: 'TGT_Y',
  4: 'TGT_D', 5: 'BDIST', 6: 'SPD', 7: 'OSC',
  8: 'AGE', 9: 'RND',
};

const ACTION_NAMES: Record<number, string> = {
  0: 'TURN_L', 1: 'TURN_R',
};

function sensorShortName(num: number): string {
  return SENSOR_NAMES[num] ?? `S${num}`;
}

function actionShortName(num: number): string {
  return ACTION_NAMES[num] ?? `A${num}`;
}
