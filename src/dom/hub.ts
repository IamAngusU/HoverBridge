import type { Point } from '../core/geometry.js';
import type { HoverBridgeController } from './controller.js';
import { activeElement, composedContains, elementAt, elementPath, eventPath, hoverPointerType } from './util.js';

const hubs = new WeakMap<Document, DocumentHub>();

/** One event subscription set per document, shared by every registered scope. */
export class DocumentHub {
  readonly members = new Set<HoverBridgeController>();
  readonly view: Window & typeof globalThis;
  point: Point | null = null;
  path: HTMLElement[] = [];
  private input: 'pointer' | 'keyboard' = 'keyboard';
  private readonly removeListeners: Array<() => void> = [];
  private readonly observer: MutationObserver;
  private processing = false;

  constructor(readonly document: Document) {
    const view = document.defaultView;
    if (!view) throw new Error('HoverBridge: the document must have a window.');
    this.view = view;
    this.listen(document, 'pointermove', this.pointer, true);
    this.listen(document, 'pointerover', this.pointer, true);
    this.listen(document, 'pointerout', this.pointerOut, true);
    this.listen(document, 'pointerdown', this.pointerDown, true);
    this.listen(document, 'pointercancel', this.cancelPointer, true);
    this.listen(document, 'click', this.click, false);
    this.listen(document, 'focusin', this.focusIn, true);
    this.listen(document, 'focusout', this.focusOut, true);
    this.listen(document, 'keydown', this.keyDown, false);
    this.listen(document, 'scroll', this.layout, true);
    this.listen(view, 'resize', this.layout, false);
    this.listen(view, 'blur', this.cancelPointer, false);
    this.listen(view, 'pagehide', this.cancelPointer, false);
    this.listen(document, 'visibilitychange', this.visibility, false);
    this.listen(document, 'toggle', this.toggle, true);
    this.observer = new view.MutationObserver(records => {
      if (!records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1))) return;
      for (const member of [...this.members]) member._reconcile();
    });
    this.observer.observe(document, { childList: true, subtree: true });
  }

  private listen(target: EventTarget, name: string, callback: EventListener, capture: boolean): void {
    target.addEventListener(name, callback, { capture, passive: name.startsWith('pointer') || name === 'scroll' });
    this.removeListeners.push(() => target.removeEventListener(name, callback, capture));
  }

  add(member: HoverBridgeController): void { this.members.add(member); }
  remove(member: HoverBridgeController): void {
    this.members.delete(member);
    if (this.members.size) return;
    this.observer.disconnect();
    this.removeListeners.forEach(remove => remove());
    hubs.delete(this.document);
  }

  isDescendant(child: HoverBridgeController, parent: HoverBridgeController, visited = new Set<HoverBridgeController>()): boolean {
    if (child === parent || visited.has(child)) return false;
    visited.add(child);
    const panel = parent._item?.panel;
    if (panel && composedContains(panel, child.root)) return true;
    for (const intermediate of this.members) {
      if (intermediate === parent || intermediate === child || !intermediate._item?.panel) continue;
      if (composedContains(intermediate._item.panel, child.root) && this.isDescendant(intermediate, parent, visited)) return true;
    }
    return false;
  }

  ordered(): HoverBridgeController[] {
    const all = [...this.members];
    const activeParents = all.filter(member => member._item?.panel);
    // Closed scopes cannot be ancestors. Cache depth once per dispatch rather
    // than walking the complete registry inside each sorting comparison.
    const depths = new Map<HoverBridgeController, number>();
    const depth = (member: HoverBridgeController, visiting = new Set<HoverBridgeController>()): number => {
      const known = depths.get(member);
      if (known !== undefined) return known;
      if (visiting.has(member)) return 0;
      visiting.add(member);
      let result = 0;
      for (const parent of activeParents) {
        if (parent !== member && composedContains(parent._item!.panel!, member.root)) {
          result = Math.max(result, 1 + depth(parent, new Set(visiting)));
        }
      }
      depths.set(member, result);
      return result;
    };
    for (const member of all) depth(member);
    return all.sort((a, b) => depths.get(b)! - depths.get(a)! || b._openedAt - a._openedAt);
  }

  childProtects(parent: HoverBridgeController): boolean {
    return [...this.members].some(child => child !== parent && child.active && this.isDescendant(child, parent)
      && (child._inside(this.path) || child.state.guarding || child.state.pinned || child._focusWithin()));
  }

  treeContains(parent: HoverBridgeController, path: readonly HTMLElement[]): boolean {
    if (parent._inside(path)) return true;
    return [...this.members].some(child => child.active && this.isDescendant(child, parent) && child._inside(path));
  }

  closeChildren(parent: HoverBridgeController): void {
    for (const child of this.ordered()) if (this.isDescendant(child, parent)) child._close('ancestor');
  }

  private readonly pointer = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (!pointer.isPrimary || !hoverPointerType(pointer.pointerType)) return;
    if (pointer.buttons !== 0) { this.cancelPointer(); return; }
    this.input = 'pointer';
    this.point = { x: pointer.clientX, y: pointer.clientY };
    this.path = eventPath(event);
    this.process(true, true);
  };

  /** Timers use the current hit target, not a stale mouseenter event. */
  tick(): void {
    if (!this.point) return;
    this.path = elementPath(elementAt(this.document, this.point.x, this.point.y));
    this.process(false, true);
  }

  private process(pointerSample: boolean, allowOpen: boolean): void {
    if (this.processing || !this.point) return;
    this.processing = true;
    try {
      const time = this.view.performance.now();
      for (const member of this.ordered()) {
        member._move(this.point, time, this.path, pointerSample, allowOpen);
      }
    } finally { this.processing = false; }
  }

  private readonly pointerOut = (event: Event): void => {
    if ((event as PointerEvent).relatedTarget === null) this.cancelPointer();
  };

  private readonly pointerDown = (event: Event): void => {
    this.input = 'pointer';
    const path = eventPath(event);
    for (const member of this.ordered()) {
      member._cancelGuard();
      if (member.active && !this.treeContains(member, path) && !member._candidate(path)) member._close('outside');
    }
  };

  private readonly click = (event: Event): void => {
    const mouse = event as MouseEvent;
    if (event.defaultPrevented || mouse.button !== 0) return;
    const path = eventPath(event);
    for (const member of this.ordered()) {
      const item = member._candidate(path);
      if (!item || !member._clickEnabled) continue;
      // The managed trigger already owns this toggle; do not run it twice.
      if (item.trigger.hasAttribute('popovertarget')) event.preventDefault();
      member._click(item);
      break;
    }
  };

  private readonly focusIn = (event: Event): void => {
    const path = eventPath(event);
    for (const member of this.ordered()) {
      member._cancelGuard();
      if (this.input === 'keyboard') member._focus(path);
    }
  };

  private readonly focusOut = (): void => {
    this.view.queueMicrotask(() => {
      for (const member of this.ordered()) member._checkFocus();
    });
  };

  private readonly keyDown = (event: Event): void => {
    this.input = 'keyboard';
    const key = event as KeyboardEvent;
    if (key.key !== 'Escape' || key.defaultPrevented) return;
    const path = elementPath(activeElement(this.document));
    const all = this.ordered().filter(member => member.active);
    const member = all.find(candidate => this.treeContains(candidate, path))
      ?? all.find(candidate => this.treeContains(candidate, this.path))
      ?? all[0];
    if (!member) return;
    const trigger = member.active!;
    const restoreFocus = member._focusWithin();
    member._suppress(trigger);
    member._close('escape');
    if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly layout = (): void => {
    if (!this.point) return;
    this.path = elementPath(elementAt(this.document, this.point.x, this.point.y));
    this.process(false, false);
  };

  private readonly visibility = (): void => {
    if (this.document.hidden) this.cancelPointer();
  };

  private readonly toggle = (event: Event): void => {
    for (const member of this.members) member._nativeToggle(event);
  };

  private readonly cancelPointer = (): void => {
    this.point = null;
    this.path = [];
    for (const member of this.members) member._pointerGone();
  };
}

export function getHub(document: Document): DocumentHub {
  let hub = hubs.get(document);
  if (!hub) { hub = new DocumentHub(document); hubs.set(document, hub); }
  return hub;
}
