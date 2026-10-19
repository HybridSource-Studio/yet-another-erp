// Hybrid Logical Clock. Each write gets a stamp of (wall-clock ms, counter, device id).
// Stamps from one device never go backwards, even if the system clock does, and stamps from
// different devices still order sensibly when their clocks drift. Encoded as a fixed-width
// string so plain string comparison is the clock order.

import type { Stamp } from "./schema";

export interface ClockState {
  ms: number;
  counter: number;
}

const MS_WIDTH = 11; // base 36, enough for any date this side of the year 5000
const COUNTER_WIDTH = 5;
const MAX_COUNTER = 36 ** COUNTER_WIDTH - 1;

export function encodeStamp(ms: number, counter: number, deviceId: string): Stamp {
  return `${ms.toString(36).padStart(MS_WIDTH, "0")}-${counter
    .toString(36)
    .padStart(COUNTER_WIDTH, "0")}-${deviceId}`;
}

export function decodeStamp(stamp: Stamp): ClockState & { deviceId: string } {
  const [ms, counter, deviceId] = stamp.split("-");
  if (ms === undefined || counter === undefined || deviceId === undefined) {
    throw new Error(`Not a clock stamp: ${stamp}`);
  }
  return { ms: parseInt(ms, 36), counter: parseInt(counter, 36), deviceId };
}

export class Clock {
  private ms: number;
  private counter: number;

  constructor(
    readonly deviceId: string,
    state: ClockState = { ms: 0, counter: 0 },
    private readonly now: () => number = Date.now,
  ) {
    this.ms = state.ms;
    this.counter = state.counter;
  }

  get state(): ClockState {
    return { ms: this.ms, counter: this.counter };
  }

  /** A stamp for a write made on this device. */
  tick(): Stamp {
    const wall = this.now();
    if (wall > this.ms) {
      this.ms = wall;
      this.counter = 0;
    } else {
      this.bump();
    }
    return encodeStamp(this.ms, this.counter, this.deviceId);
  }

  /** Moves the clock past a stamp seen elsewhere (another device, an imported file). */
  observe(stamp: Stamp): void {
    this.advanceTo(decodeStamp(stamp));
  }

  /** Moves the clock past a saved state, e.g. one another tab persisted. */
  advanceTo(other: ClockState): void {
    if (other.ms > this.ms || (other.ms === this.ms && other.counter > this.counter)) {
      this.ms = other.ms;
      this.counter = other.counter;
    }
  }

  private bump(): void {
    if (this.counter >= MAX_COUNTER) {
      this.ms += 1;
      this.counter = 0;
    } else {
      this.counter += 1;
    }
  }
}
