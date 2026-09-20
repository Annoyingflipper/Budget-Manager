// Whether the touch-drag polyfill (`drag-drop-touch`) is needed for category
// reordering.
//
// Deliberately queries `any-pointer`, not `pointer`. `(pointer: coarse)`
// reports only the device's PRIMARY pointer — on a touchscreen laptop, a
// 2-in-1, or an iPad with a Magic Keyboard/trackpad attached, the primary
// pointer is the mouse/trackpad (fine), so that query would report false
// even though the touchscreen is right there and will be used to reorder
// categories. `(any-pointer: coarse)` is true if ANY available pointer is
// coarse, so it correctly catches hybrid devices too. There is no fallback
// reorder path (no up/down buttons, no keyboard support) if this polyfill
// fails to load, so do not "simplify" this back to `pointer`.
export function needsTouchDragPolyfill(
  matchMedia: (query: string) => { matches: boolean },
): boolean {
  return matchMedia('(any-pointer: coarse)').matches;
}
