import type { IntentOptions, IntentReason } from '../core/intent.js';
import type { Point } from '../core/geometry.js';
export interface HoverBridgeItem {
    readonly trigger: HTMLElement;
    readonly panel?: HTMLElement | null;
}
export type ChangeReason = 'pointer' | 'focus' | 'click' | 'escape' | 'outside' | 'leave' | 'ancestor' | 'disabled' | 'removed' | 'api';
export interface HoverBridgeChange {
    readonly trigger: HTMLElement;
    readonly panel: HTMLElement | null;
    readonly open: boolean;
    readonly reason: ChangeReason;
}
export interface HoverBridgeOptions extends IntentOptions {
    /** Existing triggers can be bound without adding discovery attributes. */
    items?: readonly HoverBridgeItem[];
    /** Disable only trajectory protection, retaining ordinary hover behavior. */
    intent?: boolean;
    openDelay?: number;
    closeDelay?: number;
    openOnFocus?: boolean;
    clickToPin?: boolean;
    enabled?: boolean;
    debug?: boolean;
    observe?: boolean;
    /** Replaces hidden / native Popover API writes. The host owns visibility. */
    render?: (change: HoverBridgeChange) => void;
    onChange?: (change: HoverBridgeChange) => void;
    signal?: AbortSignal;
}
export type HoverBridgeTuning = Pick<HoverBridgeOptions, 'buffer' | 'restMs' | 'maxTransitMs' | 'retreatTolerance' | 'openDelay' | 'closeDelay'>;
export interface HoverBridgeMetrics {
    readonly pointerSamples: number;
    readonly protectedSamples: number;
    readonly deferredSwitches: number;
    readonly opens: number;
    readonly closes: number;
    readonly layoutReads: number;
}
export interface HoverBridgeWarning {
    readonly code: 'missing-target' | 'multiple-targets' | 'invalid-target';
    readonly trigger: HTMLElement;
    readonly message: string;
}
export interface HoverBridgeState {
    readonly active: HTMLElement | null;
    readonly panel: HTMLElement | null;
    readonly guarding: boolean;
    readonly pinned: boolean;
    readonly enabled: boolean;
    readonly reason: IntentReason | 'idle';
}
export interface HoverBridgeHandle {
    readonly root: HTMLElement;
    readonly active: HTMLElement | null;
    readonly state: HoverBridgeState;
    readonly metrics: HoverBridgeMetrics;
    readonly warnings: readonly HoverBridgeWarning[];
    readonly destroyed: boolean;
    open(trigger: HTMLElement): void;
    close(): void;
    /** Replace programmatic bindings, or pass null to resume attribute discovery. */
    setItems(items: readonly HoverBridgeItem[] | null): void;
    /** Update timing and corridor tolerance without recreating the menu. */
    setOptions(options: HoverBridgeTuning): void;
    refresh(): void;
    setEnabled(enabled: boolean): void;
    setDebug(enabled: boolean): void;
    setIntent(enabled: boolean): void;
    resetMetrics(): void;
    destroy(): void;
}
export type DiscoveryRoot = Document | ShadowRoot | HTMLElement;
export interface AutoHoverBridgeHandle {
    readonly controllers: readonly HoverBridgeHandle[];
    refresh(): void;
    destroy(): void;
}
/** A read-only adapter for components that already own visibility and events. */
export interface HoverBridgeGuardState {
    readonly hold: boolean;
    readonly reason: IntentReason | 'idle';
    readonly polygon: readonly Point[];
    readonly deadline: number | null;
}
export interface HoverBridgeGuardOptions extends IntentOptions {
    enabled?: boolean;
    onChange?: (state: HoverBridgeGuardState) => void;
    signal?: AbortSignal;
}
export interface HoverBridgeGuardHandle {
    readonly state: HoverBridgeGuardState;
    readonly destroyed: boolean;
    /** Re-evaluate the last pointer after the host changes panel visibility or layout. */
    refresh(): HoverBridgeGuardState;
    /** Seed or update from an existing pointer handler, including the first open. */
    update(event: Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerType' | 'isPrimary' | 'buttons'>): HoverBridgeGuardState;
    shouldHold(): boolean;
    setEnabled(enabled: boolean): void;
    destroy(): void;
}
//# sourceMappingURL=types.d.ts.map