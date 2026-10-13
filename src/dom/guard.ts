import { IntentTracker } from '../core/intent.js';
import type { Point } from '../core/geometry.js';
import { composedContains, hoverPointerType } from './util.js';
import type { HoverBridgeGuardHandle, HoverBridgeGuardOptions, HoverBridgeGuardState } from './types.js';

const idle: HoverBridgeGuardState = Object.freeze({ hold: false, reason: 'idle', polygon: Object.freeze([]), deadline: null });
const hubs = new WeakMap<Document, GuardHub>();

/** One passive pointer subscription per document, however many guards exist. */
class GuardHub {
  readonly members = new Set<HoverBridgeGuard>();
  private readonly removeListeners: Array<() => void> = [];
  readonly view: Window & typeof globalThis;

  constructor(readonly document: Document) {
    const view = document.defaultView;
    if (!view) throw new TypeError('HoverBridge: a guard needs a window-backed document.');
    this.view = view;
    this.listen(document, 'pointermove', this.pointer, true);
    this.listen(document, 'pointerover', this.pointer, true);
    this.listen(document, 'pointerout', this.pointerOut, true);
    this.listen(document, 'pointerdown', this.reset, true);
    this.listen(document, 'pointercancel', this.reset, true);
    this.listen(document, 'scroll', this.refresh, true);
    this.listen(view, 'resize', this.refresh, false);
    this.listen(view, 'blur', this.reset, false);
    this.listen(view, 'pagehide', this.reset, false);
    this.listen(document, 'visibilitychange', this.visibility, false);
  }

  private listen(target: EventTarget, type: string, callback: EventListener, capture: boolean): void {
    target.addEventListener(type, callback, { capture, passive: true });
    this.removeListeners.push(() => target.removeEventListener(type, callback, capture));
  }
  remove(member: HoverBridgeGuard): void {
    this.members.delete(member);
    if (this.members.size) return;
    for (const remove of this.removeListeners) remove();
    hubs.delete(this.document);
  }
  private readonly pointer = (event: Event): void => {
    const path = event.composedPath();
    for (const member of [...this.members]) member._observe(event as PointerEvent, path);
  };
  private readonly pointerOut = (event: Event): void => {
    if ((event as PointerEvent).relatedTarget === null) this.reset();
  };
  private readonly refresh = (): void => {
    for (const member of [...this.members]) if (member.state.hold) member.refresh();
  };
  private readonly reset = (): void => {
    for (const member of [...this.members]) member._reset();
  };
  private readonly visibility = (): void => {
    if (this.document.hidden) this.reset();
  };
}

function getHub(document: Document): GuardHub {
  let hub = hubs.get(document);
  if (!hub) { hub = new GuardHub(document); hubs.set(document, hub); }
  return hub;
}

class HoverBridgeGuard implements HoverBridgeGuardHandle {
  private readonly tracker: IntentTracker;
  private readonly hub: GuardHub;
  private readonly options: HoverBridgeGuardOptions;
  private point: Point | null = null;
  private current: HoverBridgeGuardState = idle;
  private timer: number | null = null;
  private enabled: boolean;
  private gone = false;
  private abortCleanup: (() => void) | null = null;

  constructor(readonly trigger: HTMLElement, readonly panel: HTMLElement, options: HoverBridgeGuardOptions) {
    const document = trigger?.ownerDocument;
    const view = document?.defaultView;
    if (!view || !(trigger instanceof view.HTMLElement) || !(panel instanceof view.HTMLElement)
      || trigger === panel || panel.ownerDocument !== document || composedContains(panel, trigger)) {
      throw new TypeError('HoverBridge: a guard needs distinct HTML endpoints in the same window-backed document.');
    }
    this.options = { ...options };
    this.tracker = new IntentTracker(options);
    this.enabled = options.enabled ?? true;
    this.hub = getHub(document);
    this.hub.members.add(this);
    if (options.signal) {
      const abort = () => this.destroy();
      options.signal.addEventListener('abort', abort, { once: true });
      this.abortCleanup = () => options.signal!.removeEventListener('abort', abort);
      if (options.signal.aborted) this.destroy();
    }
  }

  get state(): HoverBridgeGuardState { return this.current; }
  get destroyed(): boolean { return this.gone; }

  _observe(event: PointerEvent, path: readonly EventTarget[]): void {
    if (this.gone) return;
    if (this.current.hold || path.includes(this.trigger) || path.includes(this.panel)) {
      this.update(event);
      return;
    }
    if (!event.isPrimary || !hoverPointerType(event.pointerType)
      || event.buttons !== 0 || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      this._reset();
      return;
    }
    // Keep the last viewport point for an explicit refresh after a host render,
    // without measuring idle endpoints on every unrelated movement.
    this.point = { x: event.clientX, y: event.clientY };
  }

  update(event: Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerType' | 'isPrimary' | 'buttons'>): HoverBridgeGuardState {
    if (this.gone) return idle;
    if (!event.isPrimary || !hoverPointerType(event.pointerType)
      || event.buttons !== 0 || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      this._reset();
      return this.current;
    }
    this.point = { x: event.clientX, y: event.clientY };
    return this.refresh();
  }

  refresh(): HoverBridgeGuardState {
    if (this.gone || !this.enabled || !this.point || !this.trigger.isConnected || !this.panel.isConnected) {
      this._reset();
      return this.current;
    }
    const result = this.tracker.sample({ point: this.point,
      source: this.trigger.getBoundingClientRect(), target: this.panel.getBoundingClientRect(),
      time: this.hub.view.performance.now() });
    this.publish({ hold: result.hold, reason: result.reason, polygon: result.polygon, deadline: result.deadline });
    return this.current;
  }

  shouldHold(): boolean { return this.refresh().hold; }

  setEnabled(enabled: boolean): void {
    if (this.gone || this.enabled === enabled) return;
    this.enabled = enabled;
    if (enabled) this.refresh();
    else this._reset();
  }

  _reset(): void {
    if (this.gone) return;
    this.point = null;
    this.tracker.reset();
    this.publish(idle);
  }

  private publish(next: HoverBridgeGuardState): void {
    const previous = this.current;
    this.current = Object.freeze({ ...next,
      polygon: Object.freeze(next.polygon.map(point => Object.freeze({ ...point }))) });
    this.cancelTimer();
    if (next.deadline !== null && !this.gone) {
      this.timer = this.hub.view.setTimeout(() => {
        this.timer = null;
        this.refresh();
      }, Math.max(1, Math.ceil(next.deadline - this.hub.view.performance.now())));
    }
    if ((previous.hold !== next.hold || (next.hold && previous.reason !== next.reason)) && !this.gone) this.options.onChange?.(this.current);
  }

  private cancelTimer(): void {
    if (this.timer !== null) this.hub.view.clearTimeout(this.timer);
    this.timer = null;
  }

  destroy(): void {
    if (this.gone) return;
    this.gone = true;
    this.cancelTimer();
    this.abortCleanup?.();
    this.hub.remove(this);
    this.tracker.reset();
    this.point = null;
    this.current = idle;
  }
}

/** Observe a trigger/panel crossing without taking ownership of host state or DOM. */
export function createHoverBridgeGuard(
  trigger: HTMLElement, panel: HTMLElement, options: HoverBridgeGuardOptions = {},
): HoverBridgeGuardHandle {
  return new HoverBridgeGuard(trigger, panel, options);
}
