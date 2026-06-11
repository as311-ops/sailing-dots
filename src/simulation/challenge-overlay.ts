// challenge-overlay.ts -- Zielzonen-Overlay für die Regatta
// Markiert den Ziel-Quadranten, den die Boote als erstes erreichen sollen.

export type OverlayShape =
  | { type: 'circle'; cx: number; cy: number; radius: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number };

/**
 * Liefert die Zielzone als Rechteck. Quadranten in Grid-Koordinaten (y+ = Nord):
 * 0=SW, 1=SE, 2=NW, 3=NE.
 */
export function getChallengeOverlay(
  targetQuadrant: number,
  sizeX: number,
  sizeY: number,
): OverlayShape[] {
  const halfX = Math.floor(sizeX / 2);
  const halfY = Math.floor(sizeY / 2);
  return [{
    type: 'rect',
    x: (targetQuadrant & 1) === 0 ? 0 : halfX,
    y: (targetQuadrant & 2) === 0 ? 0 : halfY,
    w: (targetQuadrant & 1) === 0 ? halfX : sizeX - halfX,
    h: (targetQuadrant & 2) === 0 ? halfY : sizeY - halfY,
  }];
}
