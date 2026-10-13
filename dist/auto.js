import { autoHoverBridge } from './dom/auto.js';
export function start() {
    return autoHoverBridge();
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', start, { once: true });
    else
        start();
}
//# sourceMappingURL=auto.js.map