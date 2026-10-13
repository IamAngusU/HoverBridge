import type { Point } from '../core/geometry.js';

/** Visual inspection only. This overlay never participates in hit-testing. */
export class CorridorDebug {
  private svg: SVGSVGElement | null = null;
  private shape: SVGPolygonElement | null = null;
  constructor(private readonly document: Document) {}

  draw(points: readonly Point[]): void {
    if (!points.length) { this.clear(); return; }
    if (!this.svg) {
      const ns = 'http://www.w3.org/2000/svg';
      this.svg = this.document.createElementNS(ns, 'svg');
      this.svg.setAttribute('aria-hidden', 'true');
      this.svg.setAttribute('data-hoverbridge-debug', '');
      this.svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483647;overflow:visible;';
      this.shape = this.document.createElementNS(ns, 'polygon');
      this.shape.setAttribute('fill', '#397562');
      this.shape.setAttribute('fill-opacity', '.12');
      this.shape.setAttribute('stroke', '#397562');
      this.shape.setAttribute('stroke-width', '1.5');
      this.shape.setAttribute('stroke-dasharray', '5 4');
      this.svg.append(this.shape);
      (this.document.body ?? this.document.documentElement).append(this.svg);
    }
    this.shape!.setAttribute('points', points.map(point => `${point.x},${point.y}`).join(' '));
  }

  clear(): void { this.svg?.remove(); this.svg = null; this.shape = null; }
}
