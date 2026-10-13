import { IntentTracker, finiteOption } from '../core/intent.js';
import type { IntentDecision } from '../core/intent.js';
import type { Point } from '../core/geometry.js';
import { CorridorDebug } from './debug.js';
import { getHub } from './hub.js';
import type { DocumentHub } from './hub.js';
import { AttributeJournal, activeElement, composedContains, disabled, elementPath, itemSelector } from './util.js';
import type {
  ChangeReason, HoverBridgeChange, HoverBridgeHandle, HoverBridgeItem, HoverBridgeMetrics,
  HoverBridgeOptions, HoverBridgeState, HoverBridgeTuning, HoverBridgeWarning,
} from './types.js';

const controllers = new WeakMap<HTMLElement, HoverBridgeController>();

interface Item { trigger: HTMLElement; panel: HTMLElement | null }
const initialMetrics = () => ({ pointerSamples: 0, protectedSamples: 0, deferredSwitches: 0, opens: 0, closes: 0, layoutReads: 0 });

export class HoverBridgeController implements HoverBridgeHandle {
  readonly root: HTMLElement;
  private readonly options: HoverBridgeOptions;
  private readonly hub: DocumentHub;
  private tracker: IntentTracker;
  private readonly journal = new AttributeJournal();
  private readonly visual: CorridorDebug;
  private readonly observer: MutationObserver | null;
  private openDelay: number;
  private closeDelay: number;
  private items: Item[] = [];
  private lookup = new Map<HTMLElement, Item>();
  private notices: HoverBridgeWarning[] = [];
  private counters = initialMetrics();
  private timer: number | null = null;
  private closeAt: number | null = null;
  private pending: Item | null = null;
  private pendingAt = 0;
  private deferred: HTMLElement | null = null;
  private suppressed: HTMLElement | null = null;
  private guard = false;
  private pinned = false;
  private enabled: boolean;
  private intentEnabled: boolean;
  private debug: boolean;
  private gone = false;
  private lastDecision: IntentDecision | null = null;
  private readonly nativeStates = new Map<HTMLElement, { original: boolean; applied: boolean }>();
  private abortCleanup: (() => void) | null = null;
  _item: Item | null = null;
  _openedAt = 0;

  constructor(root: HTMLElement, options: HoverBridgeOptions = {}) {
    if (!root || !root.ownerDocument?.defaultView || !(root instanceof root.ownerDocument.defaultView.HTMLElement)) {
      throw new TypeError('HoverBridge: root must be an HTML element in a window-backed document.');
    }
    this.root = root;
    this.options = { ...options };
    this.tracker = new IntentTracker(options);
    this.openDelay = finiteOption('openDelay', options.openDelay, 0, 60000);
    this.closeDelay = finiteOption('closeDelay', options.closeDelay, 120, 60000);
    this.enabled = options.enabled ?? true;
    this.intentEnabled = options.intent ?? true;
    this.debug = options.debug ?? false;
    this.hub = getHub(root.ownerDocument);
    this.visual = new CorridorDebug(root.ownerDocument);
    this.observer = options.observe === false ? null : new this.hub.view.MutationObserver(() => {
      this.refresh();
      this._reconcile();
    });
    try {
      this.refresh();
      this.hub.add(this);
      if (options.signal) {
        const abort = () => this.destroy();
        options.signal.addEventListener('abort', abort, { once: true });
        this.abortCleanup = () => options.signal!.removeEventListener('abort', abort);
        if (options.signal.aborted) this.destroy();
      }
    } catch (error) {
      this.observer?.disconnect();
      this.journal.restore();
      this.hub.remove(this);
      throw error;
    }
  }

  get destroyed(): boolean { return this.gone; }
  get active(): HTMLElement | null { return this._item?.trigger ?? null; }
  get warnings(): readonly HoverBridgeWarning[] { return [...this.notices]; }
  get metrics(): HoverBridgeMetrics { return { ...this.counters }; }
  get state(): HoverBridgeState {
    return { active: this.active, panel: this._item?.panel ?? null, guarding: this.guard,
      pinned: this.pinned, enabled: this.enabled, reason: this.lastDecision?.reason ?? 'idle' };
  }
  get _clickEnabled(): boolean { return this.enabled && !this.gone && this.options.clickToPin !== false; }

  resetMetrics(): void { this.counters = initialMetrics(); }
  setDebug(enabled: boolean): void {
    this.debug = enabled;
    if (!enabled) this.visual.clear();
    else if (this.guard) this.visual.draw(this.lastDecision?.polygon ?? []);
  }
  setIntent(enabled: boolean): void {
    this.intentEnabled = enabled;
    this._cancelGuard();
    this.hub.tick();
  }
  setEnabled(enabled: boolean): void {
    if (this.gone || this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this._close('disabled');
  }

  private discover(): Item[] {
    this.notices = [];
    if (this.options.items) {
      return this.options.items.map(({ trigger, panel = null }: HoverBridgeItem) => {
        if (!trigger || !(trigger instanceof this.hub.view.HTMLElement) || trigger.ownerDocument !== this.root.ownerDocument
          || (panel && (!(panel instanceof this.hub.view.HTMLElement) || panel.ownerDocument !== this.root.ownerDocument || composedContains(panel, trigger)))) {
          throw new TypeError('HoverBridge: explicit items must use distinct HTML endpoints in the same document; a panel cannot contain its trigger.');
        }
        return { trigger, panel };
      }).filter(item => item.trigger.isConnected && (!item.panel || item.panel.isConnected));
    }
    const candidates = [
      ...(this.root.matches(itemSelector) ? [this.root] : []),
      ...this.root.querySelectorAll<HTMLElement>(itemSelector),
    ];
    const result: Item[] = [];
    for (const trigger of candidates) {
      const nested = trigger.closest('[data-hoverbridge]');
      if (nested && nested !== this.root && this.root.contains(nested)) continue;
      if (trigger.closest('[data-hoverbridge-ignore]')) continue;
      const controls = trigger.getAttribute('aria-controls') ?? trigger.getAttribute('popovertarget');
      if (controls === null) { result.push({ trigger, panel: null }); continue; }
      const ids = controls.trim().split(/\s+/).filter(Boolean);
      if (ids.length !== 1) {
        this.notices.push({ code: 'multiple-targets', trigger, message: 'Exactly one controlled panel ID is needed; no target was guessed.' });
        continue;
      }
      const tree = trigger.getRootNode() as Document | ShadowRoot;
      const panel = (typeof tree.getElementById === 'function' ? tree.getElementById(ids[0]!) : null)
        ?? this.root.ownerDocument.getElementById(ids[0]!);
      if (!panel) {
        this.notices.push({ code: 'missing-target', trigger, message: `No panel with ID "${ids[0]}" was found. Refresh after inserting it.` });
        continue;
      }
      if (!(panel instanceof this.hub.view.HTMLElement) || composedContains(panel, trigger)) {
        this.notices.push({ code: 'invalid-target', trigger, message: 'A controlled panel must be an HTML element that does not contain its trigger.' });
        continue;
      }
      result.push({ trigger, panel });
    }
    // Buttons inside a controlled panel belong to that panel, not its owner's
    // sibling group. Add a nested scope to give those buttons their own group.
    return result.filter(item => !result.some(other => other !== item && other.panel
      && other.panel !== this.root && composedContains(other.panel, item.trigger)));
  }

  refresh(): void {
    if (this.gone) return;
    const next = this.discover();
    if (new Set(next.map(item => item.trigger)).size !== next.length) throw new TypeError('HoverBridge: a trigger can only be registered once in a scope.');
    const current = this._item;
    if (current && (!next.some(item => item.trigger === current.trigger && item.panel === current.panel) || disabled(current.trigger))) {
      this._close(disabled(current.trigger) ? 'disabled' : 'removed');
    }
    for (const old of this.items) {
      if (next.some(item => item.trigger === old.trigger && item.panel === old.panel)) continue;
      this.journal.restoreElement(old.trigger);
      if (old.panel && !next.some(item => item.panel === old.panel)) this.journal.restoreElement(old.panel);
    }
    const previous = this.lookup;
    this.items = next;
    this.lookup = new Map(next.map(item => [item.trigger, item]));
    if (this._item) this._item = this.lookup.get(this._item.trigger) ?? null;
    for (const item of next) {
      if (previous.get(item.trigger)?.panel === item.panel) continue;
      // Discovery is explicit ownership. Start closed; source markup remains
      // recorded and is restored on destroy(). No user callback during setup.
      this.apply(item, false, 'api', false);
    }
    this.observe();
  }

  private observe(): void {
    if (!this.observer || this.gone) return;
    this.observer.disconnect();
    this.observer.observe(this.root, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['aria-controls', 'popovertarget', 'data-hoverbridge-item', 'disabled', 'aria-disabled', 'inert'] });
    if (this._item?.panel && !this.options.render) {
      this.observer.observe(this._item.panel, { attributes: true, attributeFilter: ['hidden'] });
    }
  }

  _reconcile(): void {
    if (this.gone) return;
    if (!this.root.isConnected) { this.destroy(); return; }
    const item = this._item;
    if (item && (!item.trigger.isConnected || (item.panel && !item.panel.isConnected))) { this.refresh(); return; }
    if (item && disabled(item.trigger)) { this._close('disabled'); return; }
    if (item?.panel && !this.options.render && item.panel.hidden) this._close('outside');
  }

  _candidate(path: readonly HTMLElement[]): Item | null {
    if (this.gone || !this.enabled) return null;
    for (const element of path) {
      const item = this.lookup.get(element);
      if (item && !disabled(item.trigger) && item.trigger.isConnected) return item;
    }
    return null;
  }

  _inside(path: readonly HTMLElement[]): boolean {
    const item = this._item;
    if (!item) return false;
    return path.some(element => element === item.trigger || element === item.panel);
  }

  _focusWithin(): boolean {
    return !!this.active && this.hub.treeContains(this, elementPath(activeElement(this.root.ownerDocument)));
  }

  private sample(point: Point, time: number): IntentDecision | null {
    const item = this._item;
    if (!item?.panel) return null;
    this.counters.layoutReads += 2;
    return this.tracker.sample({ point, time,
      source: item.trigger.getBoundingClientRect(), target: item.panel.getBoundingClientRect() });
  }

  _move(point: Point, time: number, path: readonly HTMLElement[], pointerSample: boolean, allowOpen: boolean): void {
    if (!this.enabled || this.gone) return;
    this._reconcile();
    if (this.gone) return;
    const candidate = this._candidate(path);
    // Leaving a dismissed trigger rearms it, even when no item is active.
    if (this.suppressed && !path.includes(this.suppressed)) this.suppressed = null;
    if (!this._item && (!candidate || !allowOpen)) { this.cancelTimer(); this.pending = null; return; }
    if (pointerSample) this.counters.pointerSamples++;
    if (candidate?.trigger === this.suppressed) return;
    if (!this._item) { if (candidate && allowOpen) this.wantOpen(candidate, time); return; }
    if (this.pinned || this._focusWithin() || this.hub.childProtects(this)) {
      this.setGuard(false);
      this.cancelTimer();
      this.closeAt = null;
      return;
    }
    if (this._inside(path)) {
      this.lastDecision = this.sample(point, time);
      this.setGuard(false);
      this.cancelTimer();
      this.pending = null;
      this.closeAt = null;
      return;
    }
    this.lastDecision = this.intentEnabled ? this.sample(point, time) : null;
    if (this.lastDecision?.hold && this.lastDecision.reason === 'corridor') {
      this.setGuard(true);
      this.counters.protectedSamples++;
      if (candidate && candidate.trigger !== this.active && candidate.trigger !== this.deferred) {
        this.counters.deferredSwitches++;
        this.deferred = candidate.trigger;
      }
      this.closeAt = null;
      this.pending = null;
      if (this.debug) this.visual.draw(this.lastDecision.polygon);
      this.schedule(this.lastDecision.deadline!);
      return;
    }
    this.setGuard(false);
    if (candidate && candidate.trigger !== this.active && allowOpen) this.wantOpen(candidate, time);
    else { this.pending = null; this.scheduleClose(time); }
  }

  private wantOpen(item: Item, time: number): void {
    this.closeAt = null;
    if (this.openDelay === 0) { this.activate(item, 'pointer'); return; }
    if (this.pending?.trigger !== item.trigger) { this.pending = item; this.pendingAt = time + this.openDelay; }
    if (time >= this.pendingAt) this.activate(item, 'pointer');
    else this.schedule(this.pendingAt);
  }

  private activate(item: Item, reason: ChangeReason): void {
    if (this.gone || !this.enabled || disabled(item.trigger)) return;
    if (this._item?.trigger === item.trigger) return;
    this._close(reason);
    if (this.gone || !this.enabled) return;
    this._item = item;
    this._openedAt = this.hub.view.performance.now();
    this.counters.opens++;
    this.apply(item, true, reason);
    // User callbacks may remove or destroy their component.
    if (this.gone || this._item !== item) return;
    if (this.hub.point) this.lastDecision = this.sample(this.hub.point, this._openedAt);
    this.observe();
  }

  open(trigger: HTMLElement): void {
    const item = this.lookup.get(trigger);
    if (!item) throw new RangeError('HoverBridge: open() expects a registered trigger. Call refresh() after changing the DOM.');
    this.suppressed = null;
    this.activate(item, 'api');
  }
  close(): void { if (this.active) this._suppress(this.active); this._close('api'); }

  setItems(items: readonly HoverBridgeItem[] | null): void {
    if (this.gone) return;
    const previous = this.options.items;
    if (items === null) delete this.options.items;
    else this.options.items = [...items];
    try { this.refresh(); }
    catch (error) {
      if (previous === undefined) delete this.options.items;
      else this.options.items = previous;
      this.refresh();
      throw error;
    }
  }

  setOptions(options: HoverBridgeTuning): void {
    if (this.gone) return;
    const tracker = new IntentTracker({ ...this.tracker.options, ...options });
    const openDelay = finiteOption('openDelay', options.openDelay, this.openDelay, 60000);
    const closeDelay = finiteOption('closeDelay', options.closeDelay, this.closeDelay, 60000);
    const sameGeometry = Object.entries(tracker.options).every(([key, value]) =>
      this.tracker.options[key as keyof typeof tracker.options] === value);
    if (sameGeometry && openDelay === this.openDelay && closeDelay === this.closeDelay) return;
    this.tracker = tracker;
    this.openDelay = openDelay;
    this.closeDelay = closeDelay;
    this._cancelGuard();
    this.hub.tick();
  }

  _close(reason: ChangeReason): void {
    this.cancelTimer();
    this.closeAt = null;
    this.pending = null;
    this.tracker.reset();
    this.setGuard(false);
    this.pinned = false;
    const item = this._item;
    if (!item) return;
    this.hub.closeChildren(this);
    this._item = null;
    this.lastDecision = null;
    this.counters.closes++;
    this.apply(item, false, reason);
    this.observe();
  }

  private isNative(panel: HTMLElement): boolean {
    return panel.hasAttribute('popover') && typeof panel.showPopover === 'function';
  }

  private apply(item: Item, open: boolean, reason: ChangeReason, notify = true): void {
    const { trigger, panel } = item;
    const change: HoverBridgeChange = { trigger, panel, open, reason };
    this.journal.set(trigger, 'data-hoverbridge-active', open ? '' : null);
    if (!open) this.journal.set(trigger, 'data-hoverbridge-pinned', null);
    if (panel) {
      this.journal.set(trigger, 'aria-expanded', String(open));
      this.journal.set(panel, 'data-hoverbridge-open', open ? '' : null);
      if (this.options.render) {
        if (notify) this.options.render(change);
      } else if (this.isNative(panel)) {
        const isOpen = panel.matches(':popover-open');
        if (!this.nativeStates.has(panel)) this.nativeStates.set(panel, { original: isOpen, applied: open });
        else this.nativeStates.get(panel)!.applied = open;
        this.journal.set(panel, 'hidden', null);
        if (open && !isOpen && panel.isConnected) panel.showPopover();
        else if (!open && isOpen) panel.hidePopover();
      } else this.journal.set(panel, 'hidden', open ? null : '');
    }
    if (!notify) return;
    this.options.onChange?.(change);
    if (!this.gone) this.root.dispatchEvent(new this.hub.view.CustomEvent('hoverbridge:change', { bubbles: true, composed: true, detail: change }));
  }

  _nativeToggle(event: Event): void {
    const panel = this._item?.panel;
    if (panel && event.target === panel && this.isNative(panel) && !panel.matches(':popover-open')) this._close('outside');
  }

  _click(item: Item): void {
    this.suppressed = null;
    if (this.active === item.trigger && this.pinned) { this._suppress(item.trigger); this._close('click'); return; }
    this.activate(item, 'click');
    if (this.active === item.trigger && item.panel) {
      this.pinned = true;
      this._cancelGuard();
      this.journal.set(item.trigger, 'data-hoverbridge-pinned', '');
    }
  }
  _focus(path: readonly HTMLElement[]): void {
    if (this.options.openOnFocus === false) return;
    const item = this._candidate(path);
    if (item && item.trigger !== this.suppressed) this.activate(item, 'focus');
  }
  _checkFocus(): void {
    if (this.suppressed && !composedContains(this.suppressed, activeElement(this.root.ownerDocument))) this.suppressed = null;
    if (!this.active || this.gone || this.pinned || this._focusWithin() || this.hub.treeContains(this, this.hub.path)) return;
    this.scheduleClose(this.hub.view.performance.now());
  }
  _suppress(trigger: HTMLElement): void { this.suppressed = trigger; }

  _cancelGuard(): void {
    this.tracker.reset();
    this.setGuard(false);
    this.cancelTimer();
    this.closeAt = null;
    this.pending = null;
  }
  _pointerGone(): void {
    this._cancelGuard();
    if (this.active && !this.pinned && !this._focusWithin()) this.scheduleClose(this.hub.view.performance.now());
  }

  private setGuard(value: boolean): void {
    if (this.guard === value) return;
    this.guard = value;
    if (!value) { this.visual.clear(); this.deferred = null; }
    this.journal.set(this.root, 'data-hoverbridge-guarding', value ? '' : null);
    for (const item of this.items) this.journal.set(item.trigger, 'data-hoverbridge-blocked', value && item.trigger !== this.active ? '' : null);
    this.root.dispatchEvent(new this.hub.view.CustomEvent('hoverbridge:intent', { bubbles: true, composed: true,
      detail: { guarding: value, reason: this.lastDecision?.reason ?? 'idle', polygon: this.lastDecision?.polygon ?? [] } }));
  }

  private scheduleClose(time: number): void {
    if (!this.active || this.pinned || this._focusWithin()) return;
    this.closeAt ??= time + this.closeDelay;
    if (time >= this.closeAt) this._close('leave');
    else this.schedule(this.closeAt);
  }
  private schedule(deadline: number): void {
    this.cancelTimer();
    this.timer = this.hub.view.setTimeout(() => {
      this.timer = null;
      if (this.gone) return;
      if (this.hub.point) this.hub.tick();
      else if (this.active && !this.pinned && !this._focusWithin()) this._close('leave');
    }, Math.max(1, Math.ceil(deadline - this.hub.view.performance.now())));
  }
  private cancelTimer(): void {
    if (this.timer !== null) this.hub.view.clearTimeout(this.timer);
    this.timer = null;
  }

  destroy(): void {
    if (this.gone) return;
    this.gone = true;
    this.cancelTimer();
    this.observer?.disconnect();
    this.abortCleanup?.();
    this.visual.clear();
    for (const [panel, state] of this.nativeStates) {
      if (!panel.isConnected || !this.isNative(panel) || panel.matches(':popover-open') !== state.applied) continue;
      if (state.original && !state.applied) panel.showPopover();
      else if (!state.original && state.applied) panel.hidePopover();
    }
    this.journal.restore();
    this.guard = false;
    this.pinned = false;
    this.enabled = false;
    this.lastDecision = null;
    this._item = null;
    this.items = [];
    this.lookup.clear();
    this.hub.remove(this);
  }
}

export function createHoverBridge(root: HTMLElement, options: HoverBridgeOptions = {}): HoverBridgeHandle {
  const existing = controllers.get(root);
  if (existing && !existing.destroyed) return existing;
  const controller = new HoverBridgeController(root, options);
  if (!controller.destroyed) controllers.set(root, controller);
  return controller;
}

/** Smallest managed setup for a single trigger and panel, without markup changes. */
export function connectHoverBridge(
  trigger: HTMLElement, panel: HTMLElement, options: Omit<HoverBridgeOptions, 'items'> = {},
): HoverBridgeHandle {
  if (!panel) throw new TypeError('HoverBridge: connectHoverBridge() needs a panel.');
  return createHoverBridge(trigger, { ...options, items: [{ trigger, panel }] });
}
