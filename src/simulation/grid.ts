// grid.ts -- 2D grid for the simulation arena
// Ported from biosim4: grid.h, grid.cpp, createBarrier.cpp

import { Coord, EMPTY, BARRIER } from './types';
import { randomUint } from './random';
import type { SimParams } from './params';

/**
 * Grid is a 2D container of uint16 values.
 * Elements are either EMPTY (0), BARRIER (0xFFFF), or an index into peeps[].
 * Column-major layout: data is stored as columns[x][y], matching the C++ version.
 */
export class Grid {
  private data!: Uint16Array;
  private _sizeX: number = 0;
  private _sizeY: number = 0;
  private _barrierLocations: Coord[] = [];
  private _barrierCenters: Coord[] = [];

  get sizeX(): number {
    return this._sizeX;
  }

  get sizeY(): number {
    return this._sizeY;
  }

  get barrierLocations(): ReadonlyArray<Coord> {
    return this._barrierLocations;
  }

  get barrierCenters(): ReadonlyArray<Coord> {
    return this._barrierCenters;
  }

  /**
   * Allocate and zero-fill the grid.
   */
  init(sizeX: number, sizeY: number): void {
    this._sizeX = sizeX;
    this._sizeY = sizeY;
    this.data = new Uint16Array(sizeX * sizeY);
  }

  zeroFill(): void {
    this.data.fill(0);
  }

  // --- Element access (column-major: index = x * sizeY + y) ---

  at(loc: Coord): number;
  at(x: number, y: number): number;
  at(xOrLoc: Coord | number, y?: number): number {
    if (xOrLoc instanceof Coord) {
      return this.data[xOrLoc.x * this._sizeY + xOrLoc.y];
    }
    return this.data[(xOrLoc as number) * this._sizeY + y!];
  }

  set(loc: Coord, val: number): void;
  set(x: number, y: number, val: number): void;
  set(xOrLoc: Coord | number, yOrVal: number, val?: number): void {
    if (xOrLoc instanceof Coord) {
      this.data[xOrLoc.x * this._sizeY + xOrLoc.y] = yOrVal;
    } else {
      this.data[(xOrLoc as number) * this._sizeY + yOrVal] = val!;
    }
  }

  // --- Query helpers ---

  isInBounds(loc: Coord): boolean {
    return loc.x >= 0 && loc.x < this._sizeX && loc.y >= 0 && loc.y < this._sizeY;
  }

  isEmptyAt(loc: Coord): boolean {
    return this.at(loc) === EMPTY;
  }

  isBarrierAt(loc: Coord): boolean {
    return this.at(loc) === BARRIER;
  }

  isOccupiedAt(loc: Coord): boolean {
    const v = this.at(loc);
    return v !== EMPTY && v !== BARRIER;
  }

  isBorder(loc: Coord): boolean {
    return loc.x === 0 || loc.x === this._sizeX - 1 || loc.y === 0 || loc.y === this._sizeY - 1;
  }

  /**
   * Find a random empty location. Loops until found (assumes grid is not full).
   */
  findEmptyLocation(): Coord {
    let loc: Coord;
    do {
      loc = new Coord(randomUint(0, this._sizeX - 1), randomUint(0, this._sizeY - 1));
    } while (!this.isEmptyAt(loc));
    return loc;
  }

  /**
   * Create barriers of the specified type. Types 0-6 are supported.
   * Assumes the grid has already been initialized and cleared.
   */
  createBarrier(barrierType: number, params: SimParams): void {
    this._barrierLocations = [];
    this._barrierCenters = [];

    const drawBox = (minX: number, minY: number, maxX: number, maxY: number): void => {
      for (let x = minX; x <= maxX; ++x) {
        for (let y = minY; y <= maxY; ++y) {
          this.set(x, y, BARRIER);
          this._barrierLocations.push(new Coord(x, y));
        }
      }
    };

    switch (barrierType) {
      case 0:
        // No barriers
        return;

      case 1: {
        // Vertical bar in constant location
        const minX = Math.floor(params.sizeX / 2);
        const maxX = minX + 1;
        const minY = Math.floor(params.sizeY / 4);
        const maxY = minY + Math.floor(params.sizeY / 2);
        drawBox(minX, minY, maxX, maxY);
        break;
      }

      case 2: {
        // Vertical bar in random location
        const minX = randomUint(20, params.sizeX - 20);
        const maxX = minX + 1;
        const minY = randomUint(20, Math.floor(params.sizeY / 2) - 20);
        const maxY = minY + Math.floor(params.sizeY / 2);
        drawBox(minX, minY, maxX, maxY);
        break;
      }

      case 3: {
        // Five blocks staggered
        const blockSizeX = 2;
        const blockSizeY = Math.floor(params.sizeX / 3);

        let x0 = Math.floor(params.sizeX / 4) - Math.floor(blockSizeX / 2);
        let y0 = Math.floor(params.sizeY / 4) - Math.floor(blockSizeY / 2);
        let x1 = x0 + blockSizeX;
        let y1 = y0 + blockSizeY;

        drawBox(x0, y0, x1, y1);

        x0 += Math.floor(params.sizeX / 2);
        x1 = x0 + blockSizeX;
        drawBox(x0, y0, x1, y1);

        y0 += Math.floor(params.sizeY / 2);
        y1 = y0 + blockSizeY;
        drawBox(x0, y0, x1, y1);

        x0 -= Math.floor(params.sizeX / 2);
        x1 = x0 + blockSizeX;
        drawBox(x0, y0, x1, y1);

        x0 = Math.floor(params.sizeX / 2) - Math.floor(blockSizeX / 2);
        x1 = x0 + blockSizeX;
        y0 = Math.floor(params.sizeY / 2) - Math.floor(blockSizeY / 2);
        y1 = y0 + blockSizeY;
        drawBox(x0, y0, x1, y1);
        break;
      }

      case 4: {
        // Horizontal bar in constant location
        const minX = Math.floor(params.sizeX / 4);
        const maxX = minX + Math.floor(params.sizeX / 2);
        const minY = Math.floor(params.sizeY / 2) + Math.floor(params.sizeY / 4);
        const maxY = minY + 2;
        drawBox(minX, minY, maxX, maxY);
        break;
      }

      case 5: {
        // Three floating islands (only first one used, matching C++ code)
        const radius = 3.0;
        const margin = 2 * Math.floor(radius);

        const randomLoc = (): Coord =>
          new Coord(
            randomUint(margin, params.sizeX - margin),
            randomUint(margin, params.sizeY - margin),
          );

        const center0 = randomLoc();
        let center1: Coord;
        let center2: Coord;

        do {
          center1 = randomLoc();
        } while (center0.subtract(center1).length() < margin);

        do {
          center2 = randomLoc();
        } while (
          center0.subtract(center2).length() < margin ||
          center1.subtract(center2).length() < margin
        );

        this._barrierCenters.push(center0);

        const addBarrier = (loc: Coord): void => {
          this.set(loc, BARRIER);
          this._barrierLocations.push(loc);
        };

        visitNeighborhood(center0, radius, params.sizeX, params.sizeY, addBarrier);
        break;
      }

      case 6: {
        // Spots: specified number, radius, locations along vertical center
        const numberOfLocations = 5;
        const radius = 5.0;

        const addBarrier = (loc: Coord): void => {
          this.set(loc, BARRIER);
          this._barrierLocations.push(loc);
        };

        const verticalSliceSize = Math.floor(params.sizeY / (numberOfLocations + 1));

        for (let n = 1; n <= numberOfLocations; ++n) {
          const loc = new Coord(
            Math.floor(params.sizeX / 2),
            n * verticalSliceSize,
          );
          visitNeighborhood(loc, radius, params.sizeX, params.sizeY, addBarrier);
          this._barrierCenters.push(loc);
        }
        break;
      }

      default:
        throw new Error(`Unknown barrier type: ${barrierType}`);
    }
  }

  /**
   * Streut runde Inseln (Barrier-Blobs) übers Meer. Kandidaten, die einer
   * Ausschlusszone (Startbox, Gate, Marken) zu nahe kommen, werden verworfen.
   * Ergänzt bestehende Barrieren; createBarrier() vorher aufrufen.
   */
  createIslands(
    count: number,
    exclusions: ReadonlyArray<{ x: number; y: number; r: number }>,
  ): void {
    const addBarrier = (loc: Coord): void => {
      if (this.isEmptyAt(loc)) {
        this.set(loc, BARRIER);
        this._barrierLocations.push(new Coord(loc.x, loc.y));
      }
    };

    const margin = 6;
    for (let i = 0; i < count; i++) {
      const radius = 2 + randomUint(0, 2); // 2..4
      let center: Coord | null = null;
      for (let tries = 0; tries < 50 && !center; tries++) {
        const cand = new Coord(
          randomUint(margin, this._sizeX - 1 - margin),
          randomUint(margin, this._sizeY - 1 - margin),
        );
        const clear = exclusions.every((e) => {
          const dx = cand.x - e.x;
          const dy = cand.y - e.y;
          return Math.sqrt(dx * dx + dy * dy) >= e.r + radius;
        });
        if (clear) center = cand;
      }
      if (!center) continue;
      visitNeighborhood(center, radius, this._sizeX, this._sizeY, addBarrier);
      this._barrierCenters.push(center);
    }
  }
}

/**
 * Visit all in-bounds locations within a circular neighborhood of radius
 * around the given center location. The callback is called for each valid
 * location, including the center itself.
 *
 * This is a standalone function (not a Grid method) matching the C++ design.
 */
// Reusable Coord for visitNeighborhood to avoid GC pressure
const _visitCoord = new Coord(0, 0);

export function visitNeighborhood(
  loc: Coord,
  radius: number,
  sizeX: number,
  sizeY: number,
  f: (coord: Coord) => void,
): void {
  const floorRadius = Math.floor(radius);
  const r2 = radius * radius;
  for (
    let dx = -Math.min(floorRadius, loc.x);
    dx <= Math.min(floorRadius, sizeX - loc.x - 1);
    ++dx
  ) {
    const x = loc.x + dx;
    const extentY = Math.floor(Math.sqrt(r2 - dx * dx));
    for (
      let dy = -Math.min(extentY, loc.y);
      dy <= Math.min(extentY, sizeY - loc.y - 1);
      ++dy
    ) {
      _visitCoord.x = x;
      _visitCoord.y = loc.y + dy;
      f(_visitCoord);
    }
  }
}
