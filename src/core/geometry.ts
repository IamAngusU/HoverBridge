/** Viewport CSS pixels on the web; any consistent coordinate system elsewhere. */
export interface Point { readonly x: number; readonly y: number }
export interface Rect {
  readonly left: number; readonly top: number;
  readonly right: number; readonly bottom: number;
}
export type Side = 'left' | 'right' | 'top' | 'bottom';

export function isPoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function isRect(rect: Rect): boolean {
  return Number.isFinite(rect.left) && Number.isFinite(rect.top)
    && Number.isFinite(rect.right) && Number.isFinite(rect.bottom)
    && rect.right > rect.left && rect.bottom > rect.top;
}

export function contains(rect: Rect, point: Point, padding = 0): boolean {
  return point.x >= rect.left - padding && point.x <= rect.right + padding
    && point.y >= rect.top - padding && point.y <= rect.bottom + padding;
}

export function distanceToRect(point: Point, rect: Rect): number {
  return Math.hypot(
    Math.max(rect.left - point.x, 0, point.x - rect.right),
    Math.max(rect.top - point.y, 0, point.y - rect.bottom),
  );
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Monotone-chain hull. Collinear interior points are intentionally removed. */
export function convexHull(input: readonly Point[]): Point[] {
  if (input.some(point => !isPoint(point))) return [];
  const points = [...input].sort((a, b) => a.x - b.x || a.y - b.y)
    .filter((point, index, all) => !index || point.x !== all[index - 1]!.x || point.y !== all[index - 1]!.y);
  if (points.length < 3) return points;
  const lower: Point[] = [];
  const upper: Point[] = [];
  for (const point of points) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) lower.pop();
    lower.push(point);
  }
  for (let index = points.length - 1; index >= 0; index--) {
    const point = points[index]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Inclusive edges, either winding. A degenerate polygon contains nothing. */
export function inPolygon(point: Point, polygon: readonly Point[]): boolean {
  if (!isPoint(point) || polygon.length < 3 || polygon.some(vertex => !isPoint(vertex))) return false;
  let positive = false;
  let negative = false;
  let area = 0;
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index]!;
    const b = polygon[(index + 1) % polygon.length]!;
    const value = cross(a, b, point);
    // Scale tolerance with the edge length rather than viewport position.
    const tolerance = 1e-7 * Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    positive ||= value > tolerance;
    negative ||= value < -tolerance;
    if (positive && negative) return false;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) > 1e-9;
}

function corners(rect: Rect, padding: number): Point[] {
  return [
    { x: rect.left - padding, y: rect.top - padding },
    { x: rect.right + padding, y: rect.top - padding },
    { x: rect.right + padding, y: rect.bottom + padding },
    { x: rect.left - padding, y: rect.bottom + padding },
  ];
}

/**
 * The hull includes the destination, so the same calculation handles all four
 * sides, offset panels and placement flips. No guessed left/right setting.
 */
export function safeCorridor(origin: Point, destination: Rect, buffer = 6): Point[] {
  if (!isPoint(origin) || !isRect(destination) || !Number.isFinite(buffer) || buffer < 0) return [];
  const start = buffer === 0 ? [origin] : corners({
    left: origin.x, right: origin.x, top: origin.y, bottom: origin.y,
  }, buffer);
  return convexHull([...start, ...corners(destination, buffer)]);
}

export function facingSide(source: Rect, target: Rect): Side {
  const dx = (target.left + target.right - source.left - source.right) / 2;
  const dy = (target.top + target.bottom - source.top - source.bottom) / 2;
  const width = (target.right - target.left + source.right - source.left) / 2;
  const height = (target.bottom - target.top + source.bottom - source.top) / 2;
  return Math.abs(dx) / width >= Math.abs(dy) / height
    ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
}
