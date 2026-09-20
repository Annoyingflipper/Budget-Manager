// Ambient module declaration for `drag-drop-touch`, which ships no types of
// its own (and no `@types/drag-drop-touch` package exists).
//
// This has to live in a real .d.ts file rather than inline in main.tsx.
// `declare module 'drag-drop-touch';` written inside a regular .ts/.tsx
// module fails with TS2665 ("resolves to an untyped module ... which cannot
// be augmented") because the specifier already resolves to a real (if
// typeless) file on disk — TypeScript treats an in-file `declare module` for
// an already-resolvable module as an augmentation, and augmentation of an
// untyped module is rejected. A standalone ambient declaration file sidesteps
// that: it registers `drag-drop-touch` as a fresh ambient module (typed
// `any`) for the whole program, so `import('drag-drop-touch')` in main.tsx
// resolves cleanly while a typo'd specifier still fails as "cannot find
// module" — the point of using `declare module` over an `as string` cast.
declare module 'drag-drop-touch';
