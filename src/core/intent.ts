import { contains, distanceToRect, inPolygon, isPoint, isRect, safeCorridor } from './geometry.js';
import type { Point, Rect } from './geometry.js';

export interface IntentOptions {
  /** Corridor tolerance in coordinate units (CSS pixels in the DOM adapter). */
  buffer?: number;
  /** Time without meaningful progress before a traversed sibling can win. */
  restMs?: number;
  /** Hard bound for one crossing. Never expires while inside either endpoint. */
  maxTransitMs?: number;
  /** Allowed increase over the closest reached distance, to tolerate jitter. */
  retreatTolerance?: number;
}
export type IntentReason = 'source' | 'target' | 'corridor' | 'unprimed' | 'outside'
  | 'retreat' | 'rest' | 'timeout' | 'invalid';
export interface IntentDecision {
  readonly hold: boolean;
  readonly reason: IntentReason;
  readonly polygon: readonly Point[];
  /** Absolute timestamp in the caller's clock, or null when no wakeup is needed. */
  readonly deadline: number | null;
}
export interface IntentSample {
  readonly point: Point;
  readonly source: Rect;
  readonly target: Rect;
  /** Monotonic milliseconds, injected so the core is deterministic and DOM-free. */
  readonly time: number;
}

export const intentDefaults = Object.freeze({
  buffer: 6, restMs: 360, maxTransitMs: 1800, retreatTolerance: 10,
});

export function finiteOption(name: string, value: number | undefined, fallback: number, max: number, min = 0): number {
  const result = value ?? fallback;
  if (!Number.isFinite(result) || result < min || result > max) {
    throw new RangeError(`HoverBridge: ${name} must be a finite number between ${min} and ${max}.`);
  }
  return result;
}

const decision = (hold: boolean, reason: IntentReason, polygon: readonly Point[] = [], deadline: number | null = null): IntentDecision => ({ hold, reason, polygon, deadline });

/** Stateful intent, no DOM, timers, device APIs, network or global clock. */
export class IntentTracker {
  readonly options: Readonly<Required<IntentOptions>>;
  private origin: Point | null = null;
  private from: 'source' | 'target' = 'source';
  private departedAt: number | null = null;
  private progressAt = 0;
  private bestDistance = Infinity;
  private destination: Rect | null = null;
  private released = false;
  private lastTime = -Infinity;

  constructor(options: IntentOptions = {}) {
    this.options = Object.freeze({
      buffer: finiteOption('buffer', options.buffer, intentDefaults.buffer, 128),
      restMs: finiteOption('restMs', options.restMs, intentDefaults.restMs, 60000, 1),
      maxTransitMs: finiteOption('maxTransitMs', options.maxTransitMs, intentDefaults.maxTransitMs, 60000, 1),
      retreatTolerance: finiteOption('retreatTolerance', options.retreatTolerance, intentDefaults.retreatTolerance, 256),
    });
  }

  reset(): void {
    this.origin = null;
    this.departedAt = null;
    this.destination = null;
    this.released = false;
    this.bestDistance = Infinity;
    this.lastTime = -Infinity;
  }

  sample({ point, source, target, time }: IntentSample): IntentDecision {
    if (!isPoint(point) || !isRect(source) || !isRect(target) || !Number.isFinite(time) || time < this.lastTime) {
      this.reset();
      return decision(false, 'invalid');
    }
    this.lastTime = time;
    // An actual endpoint wins over every timeout. Source first is intentional
    // when a floating panel visually overlaps its trigger.
    const endpoint = contains(source, point) ? 'source' : contains(target, point) ? 'target' : null;
    if (endpoint) {
      this.from = endpoint;
      this.origin = { ...point };
      this.departedAt = null;
      this.progressAt = time;
      this.destination = null;
      this.released = false;
      this.bestDistance = Infinity;
      return decision(true, endpoint);
    }
    if (!this.origin) return decision(false, 'unprimed');
    if (this.released) return decision(false, 'outside');
    const destination = this.from === 'source' ? target : source;
    const polygon = safeCorridor(this.origin, destination, this.options.buffer);
    if (!inPolygon(point, polygon)) {
      this.released = true;
      return decision(false, 'outside', polygon);
    }
    if (this.departedAt === null) {
      this.departedAt = time;
      this.progressAt = time;
      this.bestDistance = distanceToRect(this.origin, destination);
    }
    // A missed timer must not revive an already expired crossing merely
    // because the next sample makes progress. Endpoints above still win.
    const previousDeadline = Math.min(this.departedAt + this.options.maxTransitMs, this.progressAt + this.options.restMs);
    if (time >= previousDeadline) {
      this.released = true;
      return decision(false, time >= this.departedAt + this.options.maxTransitMs ? 'timeout' : 'rest', polygon);
    }
    const previous = this.destination;
    if (previous && (previous.left !== destination.left || previous.right !== destination.right
      || previous.top !== destination.top || previous.bottom !== destination.bottom)) {
      // A layout change is not a pointer retreat. Keep the original time budget.
      this.bestDistance = distanceToRect(point, destination);
    }
    this.destination = { ...destination };
    const distance = distanceToRect(point, destination);
    if (distance > this.bestDistance + this.options.retreatTolerance) {
      this.released = true;
      return decision(false, 'retreat', polygon);
    }
    if (distance < this.bestDistance - 0.5) {
      this.bestDistance = distance;
      this.progressAt = time;
    }
    const deadline = Math.min(this.departedAt + this.options.maxTransitMs, this.progressAt + this.options.restMs);
    if (time >= deadline) {
      this.released = true;
      return decision(false, time >= this.departedAt + this.options.maxTransitMs ? 'timeout' : 'rest', polygon);
    }
    return decision(true, 'corridor', polygon, deadline);
  }
}
