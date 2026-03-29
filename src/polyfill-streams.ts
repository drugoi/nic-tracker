import * as web from 'node:stream/web';

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
