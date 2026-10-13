export * from './core/index.js';
export { createHoverBridge, connectHoverBridge } from './dom/controller.js';
export { autoHoverBridge } from './dom/auto.js';
export { createHoverBridgeGuard } from './dom/guard.js';
export type {
  AutoHoverBridgeHandle, ChangeReason, DiscoveryRoot, HoverBridgeChange, HoverBridgeHandle,
  HoverBridgeItem, HoverBridgeMetrics, HoverBridgeOptions, HoverBridgeState, HoverBridgeWarning,
  HoverBridgeGuardHandle, HoverBridgeGuardOptions, HoverBridgeGuardState,
  HoverBridgeTuning,
} from './dom/types.js';
