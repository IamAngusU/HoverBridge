import { IntentTracker } from '../core/intent.js';
import { composedContains, hoverPointerType } from './util.js';
const idle = Object.freeze({ hold: false, reason: 'idle', polygon: Object.freeze([]), deadline: null });
const hubs = new WeakMap();
/** One passive pointer subscription per document, however many guards exist. */
class GuardHub {
    document;
    members = new Set();
    removeListeners = [];
    view;
    constructor(document) {
        this.document = document;
        const view = document.defaultView;
        if (!view)
            throw new TypeError('HoverBridge: a guard needs a window-backed document.');
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
    listen(target, type, callback, capture) {
        target.addEventListener(type, callback, { capture, passive: true });
        this.removeListeners.push(() => target.removeEventListener(type, callback, capture));
    }
    remove(member) {
        this.members.delete(member);
        if (this.members.size)
            return;
        for (const remove of this.removeListeners)
            remove();
        hubs.delete(this.document);
    }
    pointer = (event) => {
        const path = event.composedPath();
        for (const member of [...this.members])
            member._observe(event, path);
    };
    pointerOut = (event) => {
        if (event.relatedTarget === null)
            this.reset();
    };
    refresh = () => {
        for (const member of [...this.members])
            if (member.state.hold)
                member.refresh();
    };
    reset = () => {
        for (const member of [...this.members])
            member._reset();
    };
    visibility = () => {
        if (this.document.hidden)
            this.reset();
    };
}
function getHub(document) {
    let hub = hubs.get(document);
    if (!hub) {
        hub = new GuardHub(document);
        hubs.set(document, hub);
    }
    return hub;
}
class HoverBridgeGuard {
    trigger;
    panel;
    tracker;
    hub;
    options;
    point = null;
    current = idle;
    timer = null;
    enabled;
    gone = false;
    abortCleanup = null;
    constructor(trigger, panel, options) {
        this.trigger = trigger;
        this.panel = panel;
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
            this.abortCleanup = () => options.signal.removeEventListener('abort', abort);
            if (options.signal.aborted)
                this.destroy();
        }
    }
    get state() { return this.current; }
    get destroyed() { return this.gone; }
    _observe(event, path) {
        if (this.gone)
            return;
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
    update(event) {
        if (this.gone)
            return idle;
        if (!event.isPrimary || !hoverPointerType(event.pointerType)
            || event.buttons !== 0 || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
            this._reset();
            return this.current;
        }
        this.point = { x: event.clientX, y: event.clientY };
        return this.refresh();
    }
    refresh() {
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
    shouldHold() { return this.refresh().hold; }
    setEnabled(enabled) {
        if (this.gone || this.enabled === enabled)
            return;
        this.enabled = enabled;
        if (enabled)
            this.refresh();
        else
            this._reset();
    }
    _reset() {
        if (this.gone)
            return;
        this.point = null;
        this.tracker.reset();
        this.publish(idle);
    }
    publish(next) {
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
        if ((previous.hold !== next.hold || (next.hold && previous.reason !== next.reason)) && !this.gone)
            this.options.onChange?.(this.current);
    }
    cancelTimer() {
        if (this.timer !== null)
            this.hub.view.clearTimeout(this.timer);
        this.timer = null;
    }
    destroy() {
        if (this.gone)
            return;
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
export function createHoverBridgeGuard(trigger, panel, options = {}) {
    return new HoverBridgeGuard(trigger, panel, options);
}
//# sourceMappingURL=guard.js.map