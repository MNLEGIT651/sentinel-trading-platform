import '@testing-library/jest-dom/vitest';

// Polyfill ResizeObserver for jsdom (needed by lightweight-charts)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Polyfill Element.prototype.getAnimations for jsdom (needed by @base-ui/react ScrollArea)
if (typeof Element !== 'undefined' && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
}
