import { describe, expect, it } from 'vitest';

import { runExclusively } from './execution-queue.js';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('runExclusively', () => {
  it('does not start the next task until the active task completes', async () => {
    const first = deferred<void>();
    const events: string[] = [];

    const firstRun = runExclusively(async () => {
      events.push('first:start');
      await first.promise;
      events.push('first:end');
    });
    const secondRun = runExclusively(async () => {
      events.push('second:start');
      events.push('second:end');
    });

    await Promise.resolve();
    expect(events).toEqual(['first:start']);

    first.resolve();
    await Promise.all([firstRun, secondRun]);

    expect(events).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
    ]);
  });
});
