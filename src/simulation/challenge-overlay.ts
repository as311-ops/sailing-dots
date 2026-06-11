// challenge-overlay.ts -- Overlay-Formen für die Regatta:
// Ziel-Gate zwischen zwei Bojen, Startlinie und zu rundende Kurs-Marken.

import { finishGate, startBox, courseMarks, markRadius } from './sailing';

export type OverlayShape =
  | { type: 'finishline'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'startline'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'buoy'; cx: number; cy: number }
  | { type: 'mark'; cx: number; cy: number; r: number; n: number };

export function getChallengeOverlay(
  targetQuadrant: number,
  courseLegs: number,
  sizeX: number,
  sizeY: number,
): OverlayShape[] {
  const gate = finishGate(targetQuadrant, sizeX, sizeY);
  const box = startBox(targetQuadrant, sizeX, sizeY);
  const halfW = Math.floor(box.width / 2);
  const marks = courseMarks(targetQuadrant, courseLegs, sizeX, sizeY);
  const r = markRadius(sizeX);

  return [
    { type: 'finishline', x1: gate.x0, y1: gate.y, x2: gate.x1, y2: gate.y },
    { type: 'buoy', cx: gate.x0 - 1, cy: gate.y },
    { type: 'buoy', cx: gate.x1 + 1, cy: gate.y },
    ...marks.map((m, i): OverlayShape => ({ type: 'mark', cx: m.x, cy: m.y, r, n: i + 1 })),
    {
      type: 'startline',
      x1: box.centerX - halfW,
      y1: box.startLineY,
      x2: box.centerX + halfW,
      y2: box.startLineY,
    },
  ];
}
