import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { needsTouchDragPolyfill } from './utils/touchPolyfill';
// Ambient module declaration for the untyped `drag-drop-touch` package lives
// in src/drag-drop-touch.d.ts (see that file for why it can't live here).

// Touch-drag polyfill for category reordering on phones and tablets. Loaded
// only when a coarse (touch) pointer is available — see touchPolyfill.ts for
// why this checks any-pointer rather than the primary pointer. On a
// touch-only desktop it would otherwise be inert weight in the initial
// bundle.
if (typeof window !== 'undefined' && window.matchMedia && needsTouchDragPolyfill(window.matchMedia.bind(window))) {
  void import('drag-drop-touch');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
