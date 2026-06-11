// labels.ts -- Human-readable English labels for sensors, actions, and neurons

export const SENSOR_LABELS: Record<string, string> = {
  'WIND_REL_X': 'Wind Angle (cos)',
  'WIND_REL_Y': 'Wind Angle (sin)',
  'TARGET_REL_X': 'Target Bearing (cos)',
  'TARGET_REL_Y': 'Target Bearing (sin)',
  'TARGET_DIST': 'Target Distance',
  'BOUNDARY_DIST': 'Shore Proximity',
  'SPEED': 'Boat Speed',
  'OSC1': 'Internal Clock',
  'AGE': 'Age',
  'RANDOM': 'Random',
  // Short forms (genome profile)
  'WIND_X': 'Wind Angle (cos)',
  'WIND_Y': 'Wind Angle (sin)',
  'TGT_X': 'Target Bearing (cos)',
  'TGT_Y': 'Target Bearing (sin)',
  'TGT_D': 'Target Distance',
  'BDIST': 'Shore Proximity',
  'SPD': 'Boat Speed',
  'OSC': 'Internal Clock',
  'RND': 'Random',
};

export const ACTION_LABELS: Record<string, string> = {
  'TURN_LEFT': 'Turn Left',
  'TURN_RIGHT': 'Turn Right',
  'TURN_L': 'Turn Left',
  'TURN_R': 'Turn Right',
};

export function neuronLabel(id: string): string {
  // N0, N1, ... → Neuron A, B, ...
  const match = id.match(/^N(\d+)$/);
  if (match) {
    const idx = parseInt(match[1]);
    const letter = String.fromCharCode(65 + idx); // A, B, C, ...
    return `Neuron ${letter}`;
  }
  return id;
}

export function humanLabel(id: string, type?: 'sensor' | 'neuron' | 'action'): string {
  if (type === 'neuron' || /^N\d+$/.test(id)) return neuronLabel(id);
  return SENSOR_LABELS[id] ?? ACTION_LABELS[id] ?? id;
}

/**
 * Describe a connection in plain English.
 * E.g. "Wind Angle (cos) → Turn Right (+2.3)"
 */
export function connectionDescription(
  from: string,
  fromType: 'sensor' | 'neuron',
  to: string,
  toType: 'neuron' | 'action',
  weight?: number,
): string {
  const fromLabel = humanLabel(from, fromType);
  const toLabel = humanLabel(to, toType);
  if (weight !== undefined) {
    const sign = weight >= 0 ? '+' : '';
    return `${fromLabel} → ${toLabel} (${sign}${weight.toFixed(1)})`;
  }
  return `${fromLabel} → ${toLabel}`;
}
