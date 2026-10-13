import { autoHoverBridge } from './dom/auto.js';

export function start(): ReturnType<typeof autoHoverBridge> {
  return autoHoverBridge();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
