export declare const itemSelector = "[aria-controls], [popovertarget], [data-hoverbridge-item]";
/** An empty pointerType is allowed for an unclassified hover-capable pointer. */
export declare function hoverPointerType(type: string): boolean;
export declare function elementPath(start: Element | null): HTMLElement[];
export declare function eventPath(event: Event): HTMLElement[];
export declare function composedContains(container: Element, target: Element | null): boolean;
export declare function activeElement(document: Document): HTMLElement | null;
export declare function elementAt(document: Document, x: number, y: number): HTMLElement | null;
export declare function disabled(element: HTMLElement): boolean;
/** Restore only values that still match our last write. Never undo a host edit. */
export declare class AttributeJournal {
    private readonly entries;
    set(element: Element, name: string, value: string | null): void;
    restoreElement(element: Element): void;
    restore(): void;
}
//# sourceMappingURL=util.d.ts.map