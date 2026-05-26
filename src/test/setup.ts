import '@testing-library/jest-dom/vitest';

// jsdom 25 doesn't implement window.matchMedia. Polyfill so components that
// use useIsMobile (or any matchMedia consumer) render in the desktop branch
// during tests. Real browsers and Vite dev/build have a real implementation.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
