export const itemSelector = '[aria-controls], [popovertarget], [data-hoverbridge-item]';

/** An empty pointerType is allowed for an unclassified hover-capable pointer. */
export function hoverPointerType(type: string): boolean {
  return type === 'mouse' || type === 'pen' || type === '';
}

export function elementPath(start: Element | null): HTMLElement[] {
  const result: HTMLElement[] = [];
  let node: Node | null = start;
  while (node) {
    if (node.nodeType === 1) result.push(node as HTMLElement);
    node = node.parentNode ?? (node.nodeType === 11 ? (node as ShadowRoot).host ?? null : null);
  }
  return result;
}

export function eventPath(event: Event): HTMLElement[] {
  return event.composedPath().filter(node => (node as Node).nodeType === 1) as HTMLElement[];
}

export function composedContains(container: Element, target: Element | null): boolean {
  return target !== null && (container.contains(target) || elementPath(target).includes(container as HTMLElement));
}

export function activeElement(document: Document): HTMLElement | null {
  let element = document.activeElement;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element as HTMLElement | null;
}

export function elementAt(document: Document, x: number, y: number): HTMLElement | null {
  let element = document.elementFromPoint(x, y);
  while (element?.shadowRoot) {
    const next = element.shadowRoot.elementFromPoint(x, y);
    if (!next || next === element) break;
    element = next;
  }
  return element as HTMLElement | null;
}

export function disabled(element: HTMLElement): boolean {
  return element.matches(':disabled, [aria-disabled="true"], [inert], [data-hoverbridge-ignore]')
    || element.closest('[inert]') !== null;
}

interface AttributeWrite { previous: string | null; applied: string | null }

/** Restore only values that still match our last write. Never undo a host edit. */
export class AttributeJournal {
  private readonly entries = new Map<Element, Map<string, AttributeWrite>>();

  set(element: Element, name: string, value: string | null): void {
    let writes = this.entries.get(element);
    if (!writes) { writes = new Map(); this.entries.set(element, writes); }
    const entry = writes.get(name);
    if (entry) entry.applied = value;
    else writes.set(name, { previous: element.getAttribute(name), applied: value });
    if (element.getAttribute(name) === value) return;
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  restoreElement(element: Element): void {
    const writes = this.entries.get(element);
    if (!writes) return;
    for (const [name, { previous, applied }] of writes) {
      if (element.getAttribute(name) !== applied) continue;
      if (previous === null) element.removeAttribute(name);
      else element.setAttribute(name, previous);
    }
    this.entries.delete(element);
  }

  restore(): void {
    for (const element of this.entries.keys()) this.restoreElement(element);
  }
}
