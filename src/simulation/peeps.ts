// peeps.ts -- Manages the population of individuals
// Ported from biosim4: peeps.h, peeps.cpp

import { Coord, Dir, type Indiv, createDefaultIndiv } from './types';
import type { Grid } from './grid';

/**
 * Peeps manages a container of Indiv agents and their locations in the grid.
 * Index 0 is reserved and not a valid individual.
 */
export class Peeps {
  private individuals: Indiv[] = [];
  private deathQueue: number[] = [];
  private moveQueue: Array<{ index: number; newLoc: Coord }> = [];

  get population(): number {
    // individuals[0] is reserved, so actual count is length - 1
    return Math.max(0, this.individuals.length - 1);
  }

  /**
   * Initialize the population with the given size.
   * Index 0 is reserved, so individuals has population+1 entries.
   * Each individual is placed via locFinder (default: random empty location)
   * and starts with a random heading.
   */
  init(population: number, grid: Grid, locFinder?: (grid: Grid) => Coord): void {
    this.individuals = new Array(population + 1);

    // Index 0 is reserved
    this.individuals[0] = createDefaultIndiv();

    for (let i = 1; i <= population; i++) {
      const indiv = createDefaultIndiv();
      indiv.alive = true;
      indiv.index = i;
      const loc = locFinder ? locFinder(grid) : grid.findEmptyLocation();
      indiv.loc = loc;
      indiv.birthLoc = new Coord(loc.x, loc.y);
      indiv.heading = Dir.random8();
      grid.set(loc, i);
      this.individuals[i] = indiv;
    }

    this.deathQueue.length = 0;
    this.moveQueue.length = 0;
  }

  /**
   * Get individual by index. No bounds checking.
   */
  getIndiv(index: number): Indiv {
    return this.individuals[index];
  }

  /**
   * Get individual at a grid location. Requires that loc is occupied.
   */
  getIndivAt(loc: Coord, grid: Grid): Indiv {
    return this.individuals[grid.at(loc)];
  }

  /**
   * Direct array-like access by index.
   */
  at(index: number): Indiv {
    return this.individuals[index];
  }

  /**
   * Queue an individual for death. The individual remains alive until
   * drainDeathQueue() is called. Safe to queue the same individual multiple times.
   */
  queueForDeath(index: number): void {
    this.deathQueue.push(index);
  }

  /**
   * Execute all queued deaths. Removes dead agents from the grid.
   * Called in single-thread mode at the end of a sim step.
   */
  drainDeathQueue(grid: Grid): void {
    for (const index of this.deathQueue) {
      const indiv = this.individuals[index];
      if (indiv && indiv.alive) {
        grid.set(indiv.loc, 0);
        indiv.alive = false;
      }
    }
    this.deathQueue.length = 0;
  }

  get deathQueueSize(): number {
    return this.deathQueue.length;
  }

  /**
   * Queue an individual to be moved to a new location.
   * The move doesn't happen until drainMoveQueue() is called.
   */
  queueForMove(index: number, newLoc: Coord): void {
    this.moveQueue.push({ index, newLoc });
  }

  /**
   * Execute all queued moves. Each move is typically one 8-neighbor distance.
   * If the target location is not empty, the move is skipped.
   * Dead agents in the queue are ignored.
   * Called in single-thread mode at the end of a sim step.
   */
  drainMoveQueue(grid: Grid): void {
    for (const record of this.moveQueue) {
      const indiv = this.individuals[record.index];
      if (indiv && indiv.alive) {
        const newLoc = record.newLoc;
        const moveDir = newLoc.subtract(indiv.loc).asDir();
        if (grid.isEmptyAt(newLoc)) {
          grid.set(indiv.loc, 0);
          grid.set(newLoc, indiv.index);
          indiv.loc = newLoc;
          indiv.lastMoveDir = moveDir;
        }
      }
    }
    this.moveQueue.length = 0;
  }
}
