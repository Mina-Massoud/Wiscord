/**
 * Module declarations for asset imports that come from inside other
 * packages' `exports` maps. Vite resolves these at build time, but
 * TypeScript needs the shapes spelled out — vite/client only covers
 * project-local `?url` imports, not third-party ones.
 */

declare module '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url' {
  const src: string;
  export default src;
}

declare module '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url' {
  const src: string;
  export default src;
}

declare module '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url' {
  const src: string;
  export default src;
}
