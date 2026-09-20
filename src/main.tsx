import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Touch-drag polyfill for category reordering on phones and tablets. Loaded
// only on coarse-pointer devices — on desktop it is inert weight in the
// initial bundle.
if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) {
  // Untyped package (no bundled types, no @types/drag-drop-touch): widen the
  // specifier past a string literal so TS resolves this to Promise<any>
  // instead of trying (and failing) to load a declaration file for it.
  void import('drag-drop-touch' as string);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
