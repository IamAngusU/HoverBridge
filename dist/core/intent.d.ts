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
export type IntentReason = 'source' | 'target' | 'corridor' | 'unprimed' | 'outside' | 'retreat' | 'rest' | 'timeout' | 'invalid';
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
export declare const intentDefaults: Readonly<{
    buffer: 6;
    restMs: 360;
    maxTransitMs: 1800;
    retreatTolerance: 10;
}>;
export declare function finiteOption(name: string, value: number | undefined, fallback: number, max: number, min?: number): number;
/** Stateful intent, no DOM, timers, device APIs, network or global clock. */
export declare class IntentTracker {
    readonly options: Readonly<Required<IntentOptions>>;
    private origin;
    private from;
    private departedAt;
    private progressAt;
    private bestDistance;
    private destination;
    private released;
    private lastTime;
    constructor(options?: IntentOptions);
    reset(): void;
    sample({ point, source, target, time }: IntentSample): IntentDecision;
}
//# sourceMappingURL=intent.d.ts.map