/*! HoverBridge v0.2.0-alpha.3 | MIT | Angus Uelsmann | angusu.de */
(function(global){'use strict';
const modules={"auto.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = start;
const auto_js_1 = require("./dom/auto.js");
function start() {
    return (0, auto_js_1.autoHoverBridge)();
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', start, { once: true });
    else
        start();
}

},
"browser.js":function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = void 0;
__exportStar(require("./index.js"), exports);
var auto_js_1 = require("./auto.js");
Object.defineProperty(exports, "start", { enumerable: true, get: function () { return auto_js_1.start; } });

},
"core/geometry.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPoint = isPoint;
exports.isRect = isRect;
exports.contains = contains;
exports.distanceToRect = distanceToRect;
exports.convexHull = convexHull;
exports.inPolygon = inPolygon;
exports.safeCorridor = safeCorridor;
exports.facingSide = facingSide;
function isPoint(point) {
    return Number.isFinite(point.x) && Number.isFinite(point.y);
}
function isRect(rect) {
    return Number.isFinite(rect.left) && Number.isFinite(rect.top)
        && Number.isFinite(rect.right) && Number.isFinite(rect.bottom)
        && rect.right > rect.left && rect.bottom > rect.top;
}
function contains(rect, point, padding = 0) {
    return point.x >= rect.left - padding && point.x <= rect.right + padding
        && point.y >= rect.top - padding && point.y <= rect.bottom + padding;
}
function distanceToRect(point, rect) {
    return Math.hypot(Math.max(rect.left - point.x, 0, point.x - rect.right), Math.max(rect.top - point.y, 0, point.y - rect.bottom));
}
function cross(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function convexHull(input) {
    if (input.some(point => !isPoint(point)))
        return [];
    const points = [...input].sort((a, b) => a.x - b.x || a.y - b.y)
        .filter((point, index, all) => !index || point.x !== all[index - 1].x || point.y !== all[index - 1].y);
    if (points.length < 3)
        return points;
    const lower = [];
    const upper = [];
    for (const point of points) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0)
            lower.pop();
        lower.push(point);
    }
    for (let index = points.length - 1; index >= 0; index--) {
        const point = points[index];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0)
            upper.pop();
        upper.push(point);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
}
function inPolygon(point, polygon) {
    if (!isPoint(point) || polygon.length < 3 || polygon.some(vertex => !isPoint(vertex)))
        return false;
    let positive = false;
    let negative = false;
    let area = 0;
    for (let index = 0; index < polygon.length; index++) {
        const a = polygon[index];
        const b = polygon[(index + 1) % polygon.length];
        const value = cross(a, b, point);
        const tolerance = 1e-7 * Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
        positive ||= value > tolerance;
        negative ||= value < -tolerance;
        if (positive && negative)
            return false;
        area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area) > 1e-9;
}
function corners(rect, padding) {
    return [
        { x: rect.left - padding, y: rect.top - padding },
        { x: rect.right + padding, y: rect.top - padding },
        { x: rect.right + padding, y: rect.bottom + padding },
        { x: rect.left - padding, y: rect.bottom + padding },
    ];
}
function safeCorridor(origin, destination, buffer = 6) {
    if (!isPoint(origin) || !isRect(destination) || !Number.isFinite(buffer) || buffer < 0)
        return [];
    const start = buffer === 0 ? [origin] : corners({
        left: origin.x, right: origin.x, top: origin.y, bottom: origin.y,
    }, buffer);
    return convexHull([...start, ...corners(destination, buffer)]);
}
function facingSide(source, target) {
    const dx = (target.left + target.right - source.left - source.right) / 2;
    const dy = (target.top + target.bottom - source.top - source.bottom) / 2;
    const width = (target.right - target.left + source.right - source.left) / 2;
    const height = (target.bottom - target.top + source.bottom - source.top) / 2;
    return Math.abs(dx) / width >= Math.abs(dy) / height
        ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
}

},
"core/index.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intentDefaults = exports.IntentTracker = exports.safeCorridor = exports.isRect = exports.isPoint = exports.inPolygon = exports.facingSide = exports.distanceToRect = exports.contains = exports.convexHull = void 0;
var geometry_js_1 = require("./geometry.js");
Object.defineProperty(exports, "convexHull", { enumerable: true, get: function () { return geometry_js_1.convexHull; } });
Object.defineProperty(exports, "contains", { enumerable: true, get: function () { return geometry_js_1.contains; } });
Object.defineProperty(exports, "distanceToRect", { enumerable: true, get: function () { return geometry_js_1.distanceToRect; } });
Object.defineProperty(exports, "facingSide", { enumerable: true, get: function () { return geometry_js_1.facingSide; } });
Object.defineProperty(exports, "inPolygon", { enumerable: true, get: function () { return geometry_js_1.inPolygon; } });
Object.defineProperty(exports, "isPoint", { enumerable: true, get: function () { return geometry_js_1.isPoint; } });
Object.defineProperty(exports, "isRect", { enumerable: true, get: function () { return geometry_js_1.isRect; } });
Object.defineProperty(exports, "safeCorridor", { enumerable: true, get: function () { return geometry_js_1.safeCorridor; } });
var intent_js_1 = require("./intent.js");
Object.defineProperty(exports, "IntentTracker", { enumerable: true, get: function () { return intent_js_1.IntentTracker; } });
Object.defineProperty(exports, "intentDefaults", { enumerable: true, get: function () { return intent_js_1.intentDefaults; } });

},
"core/intent.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentTracker = exports.intentDefaults = void 0;
exports.finiteOption = finiteOption;
const geometry_js_1 = require("./geometry.js");
exports.intentDefaults = Object.freeze({
    buffer: 6, restMs: 360, maxTransitMs: 1800, retreatTolerance: 10,
});
function finiteOption(name, value, fallback, max, min = 0) {
    const result = value ?? fallback;
    if (!Number.isFinite(result) || result < min || result > max) {
        throw new RangeError(`HoverBridge: ${name} must be a finite number between ${min} and ${max}.`);
    }
    return result;
}
const decision = (hold, reason, polygon = [], deadline = null) => ({ hold, reason, polygon, deadline });
class IntentTracker {
    options;
    origin = null;
    from = 'source';
    departedAt = null;
    progressAt = 0;
    bestDistance = Infinity;
    destination = null;
    released = false;
    lastTime = -Infinity;
    constructor(options = {}) {
        this.options = Object.freeze({
            buffer: finiteOption('buffer', options.buffer, exports.intentDefaults.buffer, 128),
            restMs: finiteOption('restMs', options.restMs, exports.intentDefaults.restMs, 60000, 1),
            maxTransitMs: finiteOption('maxTransitMs', options.maxTransitMs, exports.intentDefaults.maxTransitMs, 60000, 1),
            retreatTolerance: finiteOption('retreatTolerance', options.retreatTolerance, exports.intentDefaults.retreatTolerance, 256),
        });
    }
    reset() {
        this.origin = null;
        this.departedAt = null;
        this.destination = null;
        this.released = false;
        this.bestDistance = Infinity;
        this.lastTime = -Infinity;
    }
    sample({ point, source, target, time }) {
        if (!(0, geometry_js_1.isPoint)(point) || !(0, geometry_js_1.isRect)(source) || !(0, geometry_js_1.isRect)(target) || !Number.isFinite(time) || time < this.lastTime) {
            this.reset();
            return decision(false, 'invalid');
        }
        this.lastTime = time;
        const endpoint = (0, geometry_js_1.contains)(source, point) ? 'source' : (0, geometry_js_1.contains)(target, point) ? 'target' : null;
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
        if (!this.origin)
            return decision(false, 'unprimed');
        if (this.released)
            return decision(false, 'outside');
        const destination = this.from === 'source' ? target : source;
        const polygon = (0, geometry_js_1.safeCorridor)(this.origin, destination, this.options.buffer);
        if (!(0, geometry_js_1.inPolygon)(point, polygon)) {
            this.released = true;
            return decision(false, 'outside', polygon);
        }
        if (this.departedAt === null) {
            this.departedAt = time;
            this.progressAt = time;
            this.bestDistance = (0, geometry_js_1.distanceToRect)(this.origin, destination);
        }
        const previousDeadline = Math.min(this.departedAt + this.options.maxTransitMs, this.progressAt + this.options.restMs);
        if (time >= previousDeadline) {
            this.released = true;
            return decision(false, time >= this.departedAt + this.options.maxTransitMs ? 'timeout' : 'rest', polygon);
        }
        const previous = this.destination;
        if (previous && (previous.left !== destination.left || previous.right !== destination.right
            || previous.top !== destination.top || previous.bottom !== destination.bottom)) {
            this.bestDistance = (0, geometry_js_1.distanceToRect)(point, destination);
        }
        this.destination = { ...destination };
        const distance = (0, geometry_js_1.distanceToRect)(point, destination);
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
exports.IntentTracker = IntentTracker;

},
"dom/auto.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoHoverBridge = autoHoverBridge;
const controller_js_1 = require("./controller.js");
const installations = new WeakMap();
const numericAttributes = {
    'data-hoverbridge-buffer': 'buffer',
    'data-hoverbridge-rest-ms': 'restMs',
    'data-hoverbridge-open-delay': 'openDelay',
    'data-hoverbridge-close-delay': 'closeDelay',
};
function scopeOptions(element, options) {
    const tuning = {};
    for (const [attribute, key] of Object.entries(numericAttributes)) {
        const raw = element.getAttribute(attribute);
        if (raw === null)
            continue;
        if (raw.trim() === '')
            throw new RangeError(`HoverBridge: ${attribute} needs a number.`);
        tuning[key] = Number(raw);
    }
    return { ...options, ...tuning };
}
function autoHoverBridge(root, options = {}) {
    const scope = root ?? (typeof document !== 'undefined' ? document : undefined);
    if (!scope)
        return { controllers: [], refresh() { }, destroy() { } };
    const existing = installations.get(scope);
    if (existing)
        return existing;
    const members = new Map();
    const ownerDocument = scope.nodeType === 9 ? scope : scope.ownerDocument;
    const view = ownerDocument.defaultView;
    if (!view)
        throw new TypeError('HoverBridge: discovery needs a window-backed document.');
    let destroyed = false;
    let observer = null;
    let abortCleanup = null;
    const handle = {
        get controllers() { return [...members.values()]; },
        refresh() {
            if (destroyed)
                return;
            const roots = new Set([
                ...(scope.nodeType === 1 && scope.matches('[data-hoverbridge]') ? [scope] : []),
                ...scope.querySelectorAll('[data-hoverbridge]'),
            ]);
            for (const [element, member] of members) {
                if (!roots.has(element) || !element.isConnected || member.destroyed) {
                    member.destroy();
                    members.delete(element);
                }
            }
            for (const element of roots) {
                if (!element.isConnected)
                    continue;
                if (!members.has(element))
                    members.set(element, (0, controller_js_1.createHoverBridge)(element, scopeOptions(element, options)));
                else
                    members.get(element).refresh();
            }
        },
        destroy() {
            if (destroyed)
                return;
            destroyed = true;
            observer?.disconnect();
            abortCleanup?.();
            members.forEach(member => member.destroy());
            members.clear();
            installations.delete(scope);
        },
    };
    installations.set(scope, handle);
    try {
        handle.refresh();
        if (options.observe !== false) {
            observer = new view.MutationObserver(records => {
                if (records.some(record => record.type === 'attributes'
                    || [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1)))
                    handle.refresh();
            });
            observer.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-hoverbridge'] });
        }
        if (options.signal) {
            const abort = () => handle.destroy();
            options.signal.addEventListener('abort', abort, { once: true });
            abortCleanup = () => options.signal.removeEventListener('abort', abort);
            if (options.signal.aborted)
                handle.destroy();
        }
    }
    catch (error) {
        handle.destroy();
        throw error;
    }
    return handle;
}

},
"dom/controller.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HoverBridgeController = void 0;
exports.createHoverBridge = createHoverBridge;
exports.connectHoverBridge = connectHoverBridge;
const intent_js_1 = require("../core/intent.js");
const debug_js_1 = require("./debug.js");
const hub_js_1 = require("./hub.js");
const util_js_1 = require("./util.js");
const controllers = new WeakMap();
const initialMetrics = () => ({ pointerSamples: 0, protectedSamples: 0, deferredSwitches: 0, opens: 0, closes: 0, layoutReads: 0 });
class HoverBridgeController {
    root;
    options;
    hub;
    tracker;
    journal = new util_js_1.AttributeJournal();
    visual;
    observer;
    openDelay;
    closeDelay;
    items = [];
    lookup = new Map();
    notices = [];
    counters = initialMetrics();
    timer = null;
    closeAt = null;
    pending = null;
    pendingAt = 0;
    deferred = null;
    suppressed = null;
    guard = false;
    pinned = false;
    enabled;
    intentEnabled;
    debug;
    gone = false;
    lastDecision = null;
    nativeStates = new Map();
    abortCleanup = null;
    _item = null;
    _openedAt = 0;
    constructor(root, options = {}) {
        if (!root || !root.ownerDocument?.defaultView || !(root instanceof root.ownerDocument.defaultView.HTMLElement)) {
            throw new TypeError('HoverBridge: root must be an HTML element in a window-backed document.');
        }
        this.root = root;
        this.options = { ...options };
        this.tracker = new intent_js_1.IntentTracker(options);
        this.openDelay = (0, intent_js_1.finiteOption)('openDelay', options.openDelay, 0, 60000);
        this.closeDelay = (0, intent_js_1.finiteOption)('closeDelay', options.closeDelay, 120, 60000);
        this.enabled = options.enabled ?? true;
        this.intentEnabled = options.intent ?? true;
        this.debug = options.debug ?? false;
        this.hub = (0, hub_js_1.getHub)(root.ownerDocument);
        this.visual = new debug_js_1.CorridorDebug(root.ownerDocument);
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
                this.abortCleanup = () => options.signal.removeEventListener('abort', abort);
                if (options.signal.aborted)
                    this.destroy();
            }
        }
        catch (error) {
            this.observer?.disconnect();
            this.journal.restore();
            this.hub.remove(this);
            throw error;
        }
    }
    get destroyed() { return this.gone; }
    get active() { return this._item?.trigger ?? null; }
    get warnings() { return [...this.notices]; }
    get metrics() { return { ...this.counters }; }
    get state() {
        return { active: this.active, panel: this._item?.panel ?? null, guarding: this.guard,
            pinned: this.pinned, enabled: this.enabled, reason: this.lastDecision?.reason ?? 'idle' };
    }
    get _clickEnabled() { return this.enabled && !this.gone && this.options.clickToPin !== false; }
    resetMetrics() { this.counters = initialMetrics(); }
    setDebug(enabled) {
        this.debug = enabled;
        if (!enabled)
            this.visual.clear();
        else if (this.guard)
            this.visual.draw(this.lastDecision?.polygon ?? []);
    }
    setIntent(enabled) {
        this.intentEnabled = enabled;
        this._cancelGuard();
        this.hub.tick();
    }
    setEnabled(enabled) {
        if (this.gone || this.enabled === enabled)
            return;
        this.enabled = enabled;
        if (!enabled)
            this._close('disabled');
    }
    discover() {
        this.notices = [];
        if (this.options.items) {
            return this.options.items.map(({ trigger, panel = null }) => {
                if (!trigger || !(trigger instanceof this.hub.view.HTMLElement) || trigger.ownerDocument !== this.root.ownerDocument
                    || (panel && (!(panel instanceof this.hub.view.HTMLElement) || panel.ownerDocument !== this.root.ownerDocument || (0, util_js_1.composedContains)(panel, trigger)))) {
                    throw new TypeError('HoverBridge: explicit items must use distinct HTML endpoints in the same document; a panel cannot contain its trigger.');
                }
                return { trigger, panel };
            }).filter(item => item.trigger.isConnected && (!item.panel || item.panel.isConnected));
        }
        const candidates = [
            ...(this.root.matches(util_js_1.itemSelector) ? [this.root] : []),
            ...this.root.querySelectorAll(util_js_1.itemSelector),
        ];
        const result = [];
        for (const trigger of candidates) {
            const nested = trigger.closest('[data-hoverbridge]');
            if (nested && nested !== this.root && this.root.contains(nested))
                continue;
            if (trigger.closest('[data-hoverbridge-ignore]'))
                continue;
            const controls = trigger.getAttribute('aria-controls') ?? trigger.getAttribute('popovertarget');
            if (controls === null) {
                result.push({ trigger, panel: null });
                continue;
            }
            const ids = controls.trim().split(/\s+/).filter(Boolean);
            if (ids.length !== 1) {
                this.notices.push({ code: 'multiple-targets', trigger, message: 'Exactly one controlled panel ID is needed; no target was guessed.' });
                continue;
            }
            const tree = trigger.getRootNode();
            const panel = (typeof tree.getElementById === 'function' ? tree.getElementById(ids[0]) : null)
                ?? this.root.ownerDocument.getElementById(ids[0]);
            if (!panel) {
                this.notices.push({ code: 'missing-target', trigger, message: `No panel with ID "${ids[0]}" was found. Refresh after inserting it.` });
                continue;
            }
            if (!(panel instanceof this.hub.view.HTMLElement) || (0, util_js_1.composedContains)(panel, trigger)) {
                this.notices.push({ code: 'invalid-target', trigger, message: 'A controlled panel must be an HTML element that does not contain its trigger.' });
                continue;
            }
            result.push({ trigger, panel });
        }
        return result.filter(item => !result.some(other => other !== item && other.panel
            && other.panel !== this.root && (0, util_js_1.composedContains)(other.panel, item.trigger)));
    }
    refresh() {
        if (this.gone)
            return;
        const next = this.discover();
        if (new Set(next.map(item => item.trigger)).size !== next.length)
            throw new TypeError('HoverBridge: a trigger can only be registered once in a scope.');
        const current = this._item;
        if (current && (!next.some(item => item.trigger === current.trigger && item.panel === current.panel) || (0, util_js_1.disabled)(current.trigger))) {
            this._close((0, util_js_1.disabled)(current.trigger) ? 'disabled' : 'removed');
        }
        for (const old of this.items) {
            if (next.some(item => item.trigger === old.trigger && item.panel === old.panel))
                continue;
            this.journal.restoreElement(old.trigger);
            if (old.panel && !next.some(item => item.panel === old.panel))
                this.journal.restoreElement(old.panel);
        }
        const previous = this.lookup;
        this.items = next;
        this.lookup = new Map(next.map(item => [item.trigger, item]));
        if (this._item)
            this._item = this.lookup.get(this._item.trigger) ?? null;
        for (const item of next) {
            if (previous.get(item.trigger)?.panel === item.panel)
                continue;
            this.apply(item, false, 'api', false);
        }
        this.observe();
    }
    observe() {
        if (!this.observer || this.gone)
            return;
        this.observer.disconnect();
        this.observer.observe(this.root, { childList: true, subtree: true, attributes: true,
            attributeFilter: ['aria-controls', 'popovertarget', 'data-hoverbridge-item', 'disabled', 'aria-disabled', 'inert'] });
        if (this._item?.panel && !this.options.render) {
            this.observer.observe(this._item.panel, { attributes: true, attributeFilter: ['hidden'] });
        }
    }
    _reconcile() {
        if (this.gone)
            return;
        if (!this.root.isConnected) {
            this.destroy();
            return;
        }
        const item = this._item;
        if (item && (!item.trigger.isConnected || (item.panel && !item.panel.isConnected))) {
            this.refresh();
            return;
        }
        if (item && (0, util_js_1.disabled)(item.trigger)) {
            this._close('disabled');
            return;
        }
        if (item?.panel && !this.options.render && item.panel.hidden)
            this._close('outside');
    }
    _candidate(path) {
        if (this.gone || !this.enabled)
            return null;
        for (const element of path) {
            const item = this.lookup.get(element);
            if (item && !(0, util_js_1.disabled)(item.trigger) && item.trigger.isConnected)
                return item;
        }
        return null;
    }
    _inside(path) {
        const item = this._item;
        if (!item)
            return false;
        return path.some(element => element === item.trigger || element === item.panel);
    }
    _focusWithin() {
        return !!this.active && this.hub.treeContains(this, (0, util_js_1.elementPath)((0, util_js_1.activeElement)(this.root.ownerDocument)));
    }
    sample(point, time) {
        const item = this._item;
        if (!item?.panel)
            return null;
        this.counters.layoutReads += 2;
        return this.tracker.sample({ point, time,
            source: item.trigger.getBoundingClientRect(), target: item.panel.getBoundingClientRect() });
    }
    _move(point, time, path, pointerSample, allowOpen) {
        if (!this.enabled || this.gone)
            return;
        this._reconcile();
        if (this.gone)
            return;
        const candidate = this._candidate(path);
        if (this.suppressed && !path.includes(this.suppressed))
            this.suppressed = null;
        if (!this._item && (!candidate || !allowOpen)) {
            this.cancelTimer();
            this.pending = null;
            return;
        }
        if (pointerSample)
            this.counters.pointerSamples++;
        if (candidate?.trigger === this.suppressed)
            return;
        if (!this._item) {
            if (candidate && allowOpen)
                this.wantOpen(candidate, time);
            return;
        }
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
            if (this.debug)
                this.visual.draw(this.lastDecision.polygon);
            this.schedule(this.lastDecision.deadline);
            return;
        }
        this.setGuard(false);
        if (candidate && candidate.trigger !== this.active && allowOpen)
            this.wantOpen(candidate, time);
        else {
            this.pending = null;
            this.scheduleClose(time);
        }
    }
    wantOpen(item, time) {
        this.closeAt = null;
        if (this.openDelay === 0) {
            this.activate(item, 'pointer');
            return;
        }
        if (this.pending?.trigger !== item.trigger) {
            this.pending = item;
            this.pendingAt = time + this.openDelay;
        }
        if (time >= this.pendingAt)
            this.activate(item, 'pointer');
        else
            this.schedule(this.pendingAt);
    }
    activate(item, reason) {
        if (this.gone || !this.enabled || (0, util_js_1.disabled)(item.trigger))
            return;
        if (this._item?.trigger === item.trigger)
            return;
        this._close(reason);
        if (this.gone || !this.enabled)
            return;
        this._item = item;
        this._openedAt = this.hub.view.performance.now();
        this.counters.opens++;
        this.apply(item, true, reason);
        if (this.gone || this._item !== item)
            return;
        if (this.hub.point)
            this.lastDecision = this.sample(this.hub.point, this._openedAt);
        this.observe();
    }
    open(trigger) {
        const item = this.lookup.get(trigger);
        if (!item)
            throw new RangeError('HoverBridge: open() expects a registered trigger. Call refresh() after changing the DOM.');
        this.suppressed = null;
        this.activate(item, 'api');
    }
    close() { if (this.active)
        this._suppress(this.active); this._close('api'); }
    setItems(items) {
        if (this.gone)
            return;
        const previous = this.options.items;
        if (items === null)
            delete this.options.items;
        else
            this.options.items = [...items];
        try {
            this.refresh();
        }
        catch (error) {
            if (previous === undefined)
                delete this.options.items;
            else
                this.options.items = previous;
            this.refresh();
            throw error;
        }
    }
    setOptions(options) {
        if (this.gone)
            return;
        const tracker = new intent_js_1.IntentTracker({ ...this.tracker.options, ...options });
        const openDelay = (0, intent_js_1.finiteOption)('openDelay', options.openDelay, this.openDelay, 60000);
        const closeDelay = (0, intent_js_1.finiteOption)('closeDelay', options.closeDelay, this.closeDelay, 60000);
        const sameGeometry = Object.entries(tracker.options).every(([key, value]) => this.tracker.options[key] === value);
        if (sameGeometry && openDelay === this.openDelay && closeDelay === this.closeDelay)
            return;
        this.tracker = tracker;
        this.openDelay = openDelay;
        this.closeDelay = closeDelay;
        this._cancelGuard();
        this.hub.tick();
    }
    _close(reason) {
        this.cancelTimer();
        this.closeAt = null;
        this.pending = null;
        this.tracker.reset();
        this.setGuard(false);
        this.pinned = false;
        const item = this._item;
        if (!item)
            return;
        this.hub.closeChildren(this);
        this._item = null;
        this.lastDecision = null;
        this.counters.closes++;
        this.apply(item, false, reason);
        this.observe();
    }
    isNative(panel) {
        return panel.hasAttribute('popover') && typeof panel.showPopover === 'function';
    }
    apply(item, open, reason, notify = true) {
        const { trigger, panel } = item;
        const change = { trigger, panel, open, reason };
        this.journal.set(trigger, 'data-hoverbridge-active', open ? '' : null);
        if (!open)
            this.journal.set(trigger, 'data-hoverbridge-pinned', null);
        if (panel) {
            this.journal.set(trigger, 'aria-expanded', String(open));
            this.journal.set(panel, 'data-hoverbridge-open', open ? '' : null);
            if (this.options.render) {
                if (notify)
                    this.options.render(change);
            }
            else if (this.isNative(panel)) {
                const isOpen = panel.matches(':popover-open');
                if (!this.nativeStates.has(panel))
                    this.nativeStates.set(panel, { original: isOpen, applied: open });
                else
                    this.nativeStates.get(panel).applied = open;
                this.journal.set(panel, 'hidden', null);
                if (open && !isOpen && panel.isConnected)
                    panel.showPopover();
                else if (!open && isOpen)
                    panel.hidePopover();
            }
            else
                this.journal.set(panel, 'hidden', open ? null : '');
        }
        if (!notify)
            return;
        this.options.onChange?.(change);
        if (!this.gone)
            this.root.dispatchEvent(new this.hub.view.CustomEvent('hoverbridge:change', { bubbles: true, composed: true, detail: change }));
    }
    _nativeToggle(event) {
        const panel = this._item?.panel;
        if (panel && event.target === panel && this.isNative(panel) && !panel.matches(':popover-open'))
            this._close('outside');
    }
    _click(item) {
        this.suppressed = null;
        if (this.active === item.trigger && this.pinned) {
            this._suppress(item.trigger);
            this._close('click');
            return;
        }
        this.activate(item, 'click');
        if (this.active === item.trigger && item.panel) {
            this.pinned = true;
            this._cancelGuard();
            this.journal.set(item.trigger, 'data-hoverbridge-pinned', '');
        }
    }
    _focus(path) {
        if (this.options.openOnFocus === false)
            return;
        const item = this._candidate(path);
        if (item && item.trigger !== this.suppressed)
            this.activate(item, 'focus');
    }
    _checkFocus() {
        if (this.suppressed && !(0, util_js_1.composedContains)(this.suppressed, (0, util_js_1.activeElement)(this.root.ownerDocument)))
            this.suppressed = null;
        if (!this.active || this.gone || this.pinned || this._focusWithin() || this.hub.treeContains(this, this.hub.path))
            return;
        this.scheduleClose(this.hub.view.performance.now());
    }
    _suppress(trigger) { this.suppressed = trigger; }
    _cancelGuard() {
        this.tracker.reset();
        this.setGuard(false);
        this.cancelTimer();
        this.closeAt = null;
        this.pending = null;
    }
    _pointerGone() {
        this._cancelGuard();
        if (this.active && !this.pinned && !this._focusWithin())
            this.scheduleClose(this.hub.view.performance.now());
    }
    setGuard(value) {
        if (this.guard === value)
            return;
        this.guard = value;
        if (!value) {
            this.visual.clear();
            this.deferred = null;
        }
        this.journal.set(this.root, 'data-hoverbridge-guarding', value ? '' : null);
        for (const item of this.items)
            this.journal.set(item.trigger, 'data-hoverbridge-blocked', value && item.trigger !== this.active ? '' : null);
        this.root.dispatchEvent(new this.hub.view.CustomEvent('hoverbridge:intent', { bubbles: true, composed: true,
            detail: { guarding: value, reason: this.lastDecision?.reason ?? 'idle', polygon: this.lastDecision?.polygon ?? [] } }));
    }
    scheduleClose(time) {
        if (!this.active || this.pinned || this._focusWithin())
            return;
        this.closeAt ??= time + this.closeDelay;
        if (time >= this.closeAt)
            this._close('leave');
        else
            this.schedule(this.closeAt);
    }
    schedule(deadline) {
        this.cancelTimer();
        this.timer = this.hub.view.setTimeout(() => {
            this.timer = null;
            if (this.gone)
                return;
            if (this.hub.point)
                this.hub.tick();
            else if (this.active && !this.pinned && !this._focusWithin())
                this._close('leave');
        }, Math.max(1, Math.ceil(deadline - this.hub.view.performance.now())));
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
        this.observer?.disconnect();
        this.abortCleanup?.();
        this.visual.clear();
        for (const [panel, state] of this.nativeStates) {
            if (!panel.isConnected || !this.isNative(panel) || panel.matches(':popover-open') !== state.applied)
                continue;
            if (state.original && !state.applied)
                panel.showPopover();
            else if (!state.original && state.applied)
                panel.hidePopover();
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
exports.HoverBridgeController = HoverBridgeController;
function createHoverBridge(root, options = {}) {
    const existing = controllers.get(root);
    if (existing && !existing.destroyed)
        return existing;
    const controller = new HoverBridgeController(root, options);
    if (!controller.destroyed)
        controllers.set(root, controller);
    return controller;
}
function connectHoverBridge(trigger, panel, options = {}) {
    if (!panel)
        throw new TypeError('HoverBridge: connectHoverBridge() needs a panel.');
    return createHoverBridge(trigger, { ...options, items: [{ trigger, panel }] });
}

},
"dom/debug.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorridorDebug = void 0;
class CorridorDebug {
    document;
    svg = null;
    shape = null;
    constructor(document) {
        this.document = document;
    }
    draw(points) {
        if (!points.length) {
            this.clear();
            return;
        }
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
        this.shape.setAttribute('points', points.map(point => `${point.x},${point.y}`).join(' '));
    }
    clear() { this.svg?.remove(); this.svg = null; this.shape = null; }
}
exports.CorridorDebug = CorridorDebug;

},
"dom/guard.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHoverBridgeGuard = createHoverBridgeGuard;
const intent_js_1 = require("../core/intent.js");
const util_js_1 = require("./util.js");
const idle = Object.freeze({ hold: false, reason: 'idle', polygon: Object.freeze([]), deadline: null });
const hubs = new WeakMap();
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
            || trigger === panel || panel.ownerDocument !== document || (0, util_js_1.composedContains)(panel, trigger)) {
            throw new TypeError('HoverBridge: a guard needs distinct HTML endpoints in the same window-backed document.');
        }
        this.options = { ...options };
        this.tracker = new intent_js_1.IntentTracker(options);
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
        if (!event.isPrimary || !(0, util_js_1.hoverPointerType)(event.pointerType)
            || event.buttons !== 0 || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
            this._reset();
            return;
        }
        this.point = { x: event.clientX, y: event.clientY };
    }
    update(event) {
        if (this.gone)
            return idle;
        if (!event.isPrimary || !(0, util_js_1.hoverPointerType)(event.pointerType)
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
function createHoverBridgeGuard(trigger, panel, options = {}) {
    return new HoverBridgeGuard(trigger, panel, options);
}

},
"dom/hub.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentHub = void 0;
exports.getHub = getHub;
const util_js_1 = require("./util.js");
const hubs = new WeakMap();
class DocumentHub {
    document;
    members = new Set();
    view;
    point = null;
    path = [];
    input = 'keyboard';
    removeListeners = [];
    observer;
    processing = false;
    constructor(document) {
        this.document = document;
        const view = document.defaultView;
        if (!view)
            throw new Error('HoverBridge: the document must have a window.');
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
            if (!records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1)))
                return;
            for (const member of [...this.members])
                member._reconcile();
        });
        this.observer.observe(document, { childList: true, subtree: true });
    }
    listen(target, name, callback, capture) {
        target.addEventListener(name, callback, { capture, passive: name.startsWith('pointer') || name === 'scroll' });
        this.removeListeners.push(() => target.removeEventListener(name, callback, capture));
    }
    add(member) { this.members.add(member); }
    remove(member) {
        this.members.delete(member);
        if (this.members.size)
            return;
        this.observer.disconnect();
        this.removeListeners.forEach(remove => remove());
        hubs.delete(this.document);
    }
    isDescendant(child, parent, visited = new Set()) {
        if (child === parent || visited.has(child))
            return false;
        visited.add(child);
        const panel = parent._item?.panel;
        if (panel && (0, util_js_1.composedContains)(panel, child.root))
            return true;
        for (const intermediate of this.members) {
            if (intermediate === parent || intermediate === child || !intermediate._item?.panel)
                continue;
            if ((0, util_js_1.composedContains)(intermediate._item.panel, child.root) && this.isDescendant(intermediate, parent, visited))
                return true;
        }
        return false;
    }
    ordered() {
        const all = [...this.members];
        const activeParents = all.filter(member => member._item?.panel);
        const depths = new Map();
        const depth = (member, visiting = new Set()) => {
            const known = depths.get(member);
            if (known !== undefined)
                return known;
            if (visiting.has(member))
                return 0;
            visiting.add(member);
            let result = 0;
            for (const parent of activeParents) {
                if (parent !== member && (0, util_js_1.composedContains)(parent._item.panel, member.root)) {
                    result = Math.max(result, 1 + depth(parent, new Set(visiting)));
                }
            }
            depths.set(member, result);
            return result;
        };
        for (const member of all)
            depth(member);
        return all.sort((a, b) => depths.get(b) - depths.get(a) || b._openedAt - a._openedAt);
    }
    childProtects(parent) {
        return [...this.members].some(child => child !== parent && child.active && this.isDescendant(child, parent)
            && (child._inside(this.path) || child.state.guarding || child.state.pinned || child._focusWithin()));
    }
    treeContains(parent, path) {
        if (parent._inside(path))
            return true;
        return [...this.members].some(child => child.active && this.isDescendant(child, parent) && child._inside(path));
    }
    closeChildren(parent) {
        for (const child of this.ordered())
            if (this.isDescendant(child, parent))
                child._close('ancestor');
    }
    pointer = (event) => {
        const pointer = event;
        if (!pointer.isPrimary || !(0, util_js_1.hoverPointerType)(pointer.pointerType))
            return;
        if (pointer.buttons !== 0) {
            this.cancelPointer();
            return;
        }
        this.input = 'pointer';
        this.point = { x: pointer.clientX, y: pointer.clientY };
        this.path = (0, util_js_1.eventPath)(event);
        this.process(true, true);
    };
    tick() {
        if (!this.point)
            return;
        this.path = (0, util_js_1.elementPath)((0, util_js_1.elementAt)(this.document, this.point.x, this.point.y));
        this.process(false, true);
    }
    process(pointerSample, allowOpen) {
        if (this.processing || !this.point)
            return;
        this.processing = true;
        try {
            const time = this.view.performance.now();
            for (const member of this.ordered()) {
                member._move(this.point, time, this.path, pointerSample, allowOpen);
            }
        }
        finally {
            this.processing = false;
        }
    }
    pointerOut = (event) => {
        if (event.relatedTarget === null)
            this.cancelPointer();
    };
    pointerDown = (event) => {
        this.input = 'pointer';
        const path = (0, util_js_1.eventPath)(event);
        for (const member of this.ordered()) {
            member._cancelGuard();
            if (member.active && !this.treeContains(member, path) && !member._candidate(path))
                member._close('outside');
        }
    };
    click = (event) => {
        const mouse = event;
        if (event.defaultPrevented || mouse.button !== 0)
            return;
        const path = (0, util_js_1.eventPath)(event);
        for (const member of this.ordered()) {
            const item = member._candidate(path);
            if (!item || !member._clickEnabled)
                continue;
            if (item.trigger.hasAttribute('popovertarget'))
                event.preventDefault();
            member._click(item);
            break;
        }
    };
    focusIn = (event) => {
        const path = (0, util_js_1.eventPath)(event);
        for (const member of this.ordered()) {
            member._cancelGuard();
            if (this.input === 'keyboard')
                member._focus(path);
        }
    };
    focusOut = () => {
        this.view.queueMicrotask(() => {
            for (const member of this.ordered())
                member._checkFocus();
        });
    };
    keyDown = (event) => {
        this.input = 'keyboard';
        const key = event;
        if (key.key !== 'Escape' || key.defaultPrevented)
            return;
        const path = (0, util_js_1.elementPath)((0, util_js_1.activeElement)(this.document));
        const all = this.ordered().filter(member => member.active);
        const member = all.find(candidate => this.treeContains(candidate, path))
            ?? all.find(candidate => this.treeContains(candidate, this.path))
            ?? all[0];
        if (!member)
            return;
        const trigger = member.active;
        const restoreFocus = member._focusWithin();
        member._suppress(trigger);
        member._close('escape');
        if (restoreFocus && trigger.isConnected)
            trigger.focus({ preventScroll: true });
        event.preventDefault();
        event.stopPropagation();
    };
    layout = () => {
        if (!this.point)
            return;
        this.path = (0, util_js_1.elementPath)((0, util_js_1.elementAt)(this.document, this.point.x, this.point.y));
        this.process(false, false);
    };
    visibility = () => {
        if (this.document.hidden)
            this.cancelPointer();
    };
    toggle = (event) => {
        for (const member of this.members)
            member._nativeToggle(event);
    };
    cancelPointer = () => {
        this.point = null;
        this.path = [];
        for (const member of this.members)
            member._pointerGone();
    };
}
exports.DocumentHub = DocumentHub;
function getHub(document) {
    let hub = hubs.get(document);
    if (!hub) {
        hub = new DocumentHub(document);
        hubs.set(document, hub);
    }
    return hub;
}

},
"dom/types.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},
"dom/util.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttributeJournal = exports.itemSelector = void 0;
exports.hoverPointerType = hoverPointerType;
exports.elementPath = elementPath;
exports.eventPath = eventPath;
exports.composedContains = composedContains;
exports.activeElement = activeElement;
exports.elementAt = elementAt;
exports.disabled = disabled;
exports.itemSelector = '[aria-controls], [popovertarget], [data-hoverbridge-item]';
function hoverPointerType(type) {
    return type === 'mouse' || type === 'pen' || type === '';
}
function elementPath(start) {
    const result = [];
    let node = start;
    while (node) {
        if (node.nodeType === 1)
            result.push(node);
        node = node.parentNode ?? (node.nodeType === 11 ? node.host ?? null : null);
    }
    return result;
}
function eventPath(event) {
    return event.composedPath().filter(node => node.nodeType === 1);
}
function composedContains(container, target) {
    return target !== null && (container.contains(target) || elementPath(target).includes(container));
}
function activeElement(document) {
    let element = document.activeElement;
    while (element?.shadowRoot?.activeElement)
        element = element.shadowRoot.activeElement;
    return element;
}
function elementAt(document, x, y) {
    let element = document.elementFromPoint(x, y);
    while (element?.shadowRoot) {
        const next = element.shadowRoot.elementFromPoint(x, y);
        if (!next || next === element)
            break;
        element = next;
    }
    return element;
}
function disabled(element) {
    return element.matches(':disabled, [aria-disabled="true"], [inert], [data-hoverbridge-ignore]')
        || element.closest('[inert]') !== null;
}
class AttributeJournal {
    entries = new Map();
    set(element, name, value) {
        let writes = this.entries.get(element);
        if (!writes) {
            writes = new Map();
            this.entries.set(element, writes);
        }
        const entry = writes.get(name);
        if (entry)
            entry.applied = value;
        else
            writes.set(name, { previous: element.getAttribute(name), applied: value });
        if (element.getAttribute(name) === value)
            return;
        if (value === null)
            element.removeAttribute(name);
        else
            element.setAttribute(name, value);
    }
    restoreElement(element) {
        const writes = this.entries.get(element);
        if (!writes)
            return;
        for (const [name, { previous, applied }] of writes) {
            if (element.getAttribute(name) !== applied)
                continue;
            if (previous === null)
                element.removeAttribute(name);
            else
                element.setAttribute(name, previous);
        }
        this.entries.delete(element);
    }
    restore() {
        for (const element of this.entries.keys())
            this.restoreElement(element);
    }
}
exports.AttributeJournal = AttributeJournal;

},
"guard.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHoverBridgeGuard = void 0;
var guard_js_1 = require("./dom/guard.js");
Object.defineProperty(exports, "createHoverBridgeGuard", { enumerable: true, get: function () { return guard_js_1.createHoverBridgeGuard; } });

},
"index.js":function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHoverBridgeGuard = exports.autoHoverBridge = exports.connectHoverBridge = exports.createHoverBridge = void 0;
__exportStar(require("./core/index.js"), exports);
var controller_js_1 = require("./dom/controller.js");
Object.defineProperty(exports, "createHoverBridge", { enumerable: true, get: function () { return controller_js_1.createHoverBridge; } });
Object.defineProperty(exports, "connectHoverBridge", { enumerable: true, get: function () { return controller_js_1.connectHoverBridge; } });
var auto_js_1 = require("./dom/auto.js");
Object.defineProperty(exports, "autoHoverBridge", { enumerable: true, get: function () { return auto_js_1.autoHoverBridge; } });
var guard_js_1 = require("./dom/guard.js");
Object.defineProperty(exports, "createHoverBridgeGuard", { enumerable: true, get: function () { return guard_js_1.createHoverBridgeGuard; } });

}};
const cache=Object.create(null);
function load(id){
 if(cache[id])return cache[id].exports;
 if(!Object.prototype.hasOwnProperty.call(modules,id))throw new Error('Unknown HoverBridge module: '+id);
 const module=cache[id]={exports:{}};
 function require(request){
  const parts=id.split('/');parts.pop();
  for(const part of request.split('/')){if(part==='..')parts.pop();else if(part!=='.'&&part)parts.push(part);}
  return load(parts.join('/'));
 }
 modules[id](module,module.exports,require);return module.exports;
}
if(!global.HoverBridge)global.HoverBridge=load('browser.js');
})(globalThis);
