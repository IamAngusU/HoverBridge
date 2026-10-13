export const itemSelector = '[aria-controls], [popovertarget], [data-hoverbridge-item]';
/** An empty pointerType is allowed for an unclassified hover-capable pointer. */
export function hoverPointerType(type) {
    return type === 'mouse' || type === 'pen' || type === '';
}
export function elementPath(start) {
    const result = [];
    let node = start;
    while (node) {
        if (node.nodeType === 1)
            result.push(node);
        node = node.parentNode ?? (node.nodeType === 11 ? node.host ?? null : null);
    }
    return result;
}
export function eventPath(event) {
    return event.composedPath().filter(node => node.nodeType === 1);
}
export function composedContains(container, target) {
    return target !== null && (container.contains(target) || elementPath(target).includes(container));
}
export function activeElement(document) {
    let element = document.activeElement;
    while (element?.shadowRoot?.activeElement)
        element = element.shadowRoot.activeElement;
    return element;
}
export function elementAt(document, x, y) {
    let element = document.elementFromPoint(x, y);
    while (element?.shadowRoot) {
        const next = element.shadowRoot.elementFromPoint(x, y);
        if (!next || next === element)
            break;
        element = next;
    }
    return element;
}
export function disabled(element) {
    return element.matches(':disabled, [aria-disabled="true"], [inert], [data-hoverbridge-ignore]')
        || element.closest('[inert]') !== null;
}
/** Restore only values that still match our last write. Never undo a host edit. */
export class AttributeJournal {
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
//# sourceMappingURL=util.js.map