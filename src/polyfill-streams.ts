import * as web from 'node:stream/web';

/**
 * undici (via mongodb/cheerio/etc.) expects browser-style stream globals.
 * Node 18+ exposes them globally; Node 17 does not — PM2 often still runs 17 via PATH.
 */
const keys = ['ReadableStream', 'WritableStream', 'TransformStream'] as const;

for (const key of keys) {
  if (typeof (globalThis as Record<string, unknown>)[key] === 'undefined') {
    Object.defineProperty(globalThis, key, {
      value: web[key],
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
}
