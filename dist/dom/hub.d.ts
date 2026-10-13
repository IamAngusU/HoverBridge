import type { Point } from '../core/geometry.js';
import type { HoverBridgeController } from './controller.js';
/** One event subscription set per document, shared by every registered scope. */
export declare class DocumentHub {
    readonly document: Document;
    readonly members: Set<HoverBridgeController>;
    readonly view: Window & typeof globalThis;
    point: Point | null;
    path: HTMLElement[];
    private input;
    private readonly removeListeners;
    private readonly observer;
    private processing;
    constructor(document: Document);
    private listen;
    add(member: HoverBridgeController): void;
    remove(member: HoverBridgeController): void;
    isDescendant(child: HoverBridgeController, parent: HoverBridgeController, visited?: Set<HoverBridgeController>): boolean;
    ordered(): HoverBridgeController[];
    childProtects(parent: HoverBridgeController): boolean;
    treeContains(parent: HoverBridgeController, path: readonly HTMLElement[]): boolean;
    closeChildren(parent: HoverBridgeController): void;
    private readonly pointer;
    /** Timers use the current hit target, not a stale mouseenter event. */
    tick(): void;
    private process;
    private readonly pointerOut;
    private readonly pointerDown;
    private readonly click;
    private readonly focusIn;
    private readonly focusOut;
    private readonly keyDown;
    private readonly layout;
    private readonly visibility;
    private readonly toggle;
    private readonly cancelPointer;
}
export declare function getHub(document: Document): DocumentHub;
//# sourceMappingURL=hub.d.ts.map