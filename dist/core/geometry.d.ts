/** Viewport CSS pixels on the web; any consistent coordinate system elsewhere. */
export interface Point {
    readonly x: number;
    readonly y: number;
}
export interface Rect {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
}
export type Side = 'left' | 'right' | 'top' | 'bottom';
export declare function isPoint(point: Point): boolean;
export declare function isRect(rect: Rect): boolean;
export declare function contains(rect: Rect, point: Point, padding?: number): boolean;
export declare function distanceToRect(point: Point, rect: Rect): number;
/** Monotone-chain hull. Collinear interior points are intentionally removed. */
export declare function convexHull(input: readonly Point[]): Point[];
/** Inclusive edges, either winding. A degenerate polygon contains nothing. */
export declare function inPolygon(point: Point, polygon: readonly Point[]): boolean;
/**
 * The hull includes the destination, so the same calculation handles all four
 * sides, offset panels and placement flips. No guessed left/right setting.
 */
export declare function safeCorridor(origin: Point, destination: Rect, buffer?: number): Point[];
export declare function facingSide(source: Rect, target: Rect): Side;
//# sourceMappingURL=geometry.d.ts.map