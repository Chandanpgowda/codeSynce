/**
 * Shim for 'monaco-editor/esm/vs/editor/editor.api.js'
 *
 * @monaco-editor/react loads Monaco at runtime (via its loader), exposing the
 * instance on `window.monaco`. Bundling Monaco's ESM sources through webpack
 * breaks Next.js builds (SWC cannot parse Monaco's worker files), so packages
 * like y-monaco get this shim instead: a lazy proxy that forwards every
 * property access to the runtime-loaded Monaco instance.
 *
 * Property access only happens after the editor mounts, so `window.monaco`
 * is always available by then.
 */
'use strict';

function getMonaco() {
  if (typeof window !== 'undefined' && window.monaco) {
    return window.monaco;
  }
  throw new Error(
    '[CodeSync] Monaco is not loaded yet. The monaco API shim can only be ' +
      'used after @monaco-editor/react has mounted the editor.'
  );
}

module.exports = new Proxy(
  {},
  {
    get(_target, prop) {
      const monaco = getMonaco();
      const value = monaco[prop];
      return typeof value === 'function' ? value.bind(monaco) : value;
    },
    has(_target, prop) {
      return prop in getMonaco();
    },
  }
);