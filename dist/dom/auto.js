import { createHoverBridge } from './controller.js';
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
/** Explicit scopes only. Repeated calls for the same discovery root are idempotent. */
export function autoHoverBridge(root, options = {}) {
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
                    members.set(element, createHoverBridge(element, scopeOptions(element, options)));
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
//# sourceMappingURL=auto.js.map