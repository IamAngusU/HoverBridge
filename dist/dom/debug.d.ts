import type { Point } from '../core/geometry.js';
/** Visual inspection only. This overlay never participates in hit-testing. */
export declare class CorridorDebug {
    private readonly document;
    private svg;
    private shape;
    constructor(document: Document);
    draw(points: readonly Point[]): void;
    clear(): void;
}
//# sourceMappingURL=debug.d.ts.map