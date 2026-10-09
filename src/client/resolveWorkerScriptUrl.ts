/** Resolve worker script URLs against the document location (Pages / non-root base). */
export function resolveWorkerScriptUrl(url: string | URL): string {
  const href = url instanceof URL ? url.href : url;
  if (typeof globalThis.location?.href === 'string') {
    return new URL(href, globalThis.location.href).href;
  }
  return href;
}
