import { describe, it, expect, vi } from 'vitest';
import { needsTouchDragPolyfill } from './touchPolyfill';

describe('needsTouchDragPolyfill', () => {
  it('returns true when any available pointer is coarse', () => {
    const mql = vi.fn().mockReturnValue({ matches: true });
    expect(needsTouchDragPolyfill(mql)).toBe(true);
  });

  it('returns false when no pointer is coarse', () => {
    const mql = vi.fn().mockReturnValue({ matches: false });
    expect(needsTouchDragPolyfill(mql)).toBe(false);
  });

  it('queries any-pointer, not the primary-pointer-only "pointer" feature', () => {
    // This is the whole point of the function: `(pointer: coarse)` only
    // reports the PRIMARY pointing device, so a touchscreen laptop or an
    // iPad with a trackpad/keyboard attached would silently never load the
    // drag polyfill even though its touchscreen is right there. `any-pointer`
    // reports true if ANY available pointer is coarse. Do not "simplify"
    // this back to `pointer` — that reintroduces the bug.
    const mql = vi.fn().mockReturnValue({ matches: true });
    needsTouchDragPolyfill(mql);
    expect(mql).toHaveBeenCalledWith('(any-pointer: coarse)');
    expect(mql).not.toHaveBeenCalledWith('(pointer: coarse)');
  });
});
