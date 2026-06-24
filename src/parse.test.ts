import type { AxiosInstance } from 'axios';
import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

interface ParsedDomainData {
  whoisData: { attribute: string; value: string }[];
  parsedData: {
    orgName: string;
    registrar: string;
    clientName: string;
    clientPhoneNumber: string;
    clientEmail: string;
    clientAddress: string;
  };
}

const dbState = vi.hoisted(() => {
  const state = {
    domainsCollection: {
      findOne: vi.fn(),
      insertOne: vi.fn(),
      updateOne: vi.fn(),
    },
    oldDomainsCollection: {
      insertOne: vi.fn(),
    },
    collection: vi.fn(),
    getDb: vi.fn(),
    getWatchTerms: vi.fn(),
    updateParserStatus: vi.fn(),
  };
  state.collection.mockImplementation((name: string) => {
    if (name === 'domains') {
      return state.domainsCollection;
    }
    if (name === 'oldDomains') {
      return state.oldDomainsCollection;
    }
    throw new Error(`Unexpected collection ${name}`);
  });
  state.getDb.mockResolvedValue({ collection: state.collection });
  return state;
});

const requestMocks = vi.hoisted(() => ({
  getInstance: vi.fn(),
}));
const botMocks = vi.hoisted(() => ({
  telegram: {
    sendMessage: vi.fn(),
  },
}));
const whoisMocks = vi.hoisted(() => ({
  whoisAndParse: vi.fn(),
}));

vi.mock('./request.js', () => requestMocks);

vi.mock('./db.js', () => ({
  getDb: dbState.getDb,
  getWatchTerms: dbState.getWatchTerms,
  updateParserStatus: dbState.updateParserStatus,
}));

vi.mock('./bot-setup.js', () => ({
  bot: botMocks,
}));

vi.mock('./whois.js', () => whoisMocks);

vi.mock('./env.js', () => ({
  env: {
    tgChannelId: 'channel-id',
    tgOwnerId: 'owner-id',
  },
}));

const nicHtml = `<table id="last-ten-table"><tbody><tr></tr><tr><td><table><tbody>
<tr><td>2026-06-24</td><td><a>example.kz</a></td></tr>
</tbody></table></td></tr></tbody></table>`;

function nicHtmlFor(domain: string): string {
  return `<table id="last-ten-table"><tbody><tr></tr><tr><td><table><tbody>
<tr><td>2026-06-24</td><td><a>${domain}</a></td></tr>
</tbody></table></td></tr></tbody></table>`;
}

const fixtureUrl = new URL('./fixtures/nic-last-ten.html', import.meta.url);

const parsedDomainData: ParsedDomainData = {
  whoisData: [{ attribute: 'Organization Name', value: 'Example Org' }],
  parsedData: {
    orgName: 'Example Org',
    registrar: 'Example Registrar',
    clientName: 'Example Client',
    clientPhoneNumber: '+77000000000',
    clientEmail: 'admin@example.kz',
    clientAddress: 'Example Street',
  },
};

function axiosWithResult(result: Promise<{ data: string }>): AxiosInstance {
  return {
    get: vi.fn(() => result),
  } as unknown as AxiosInstance;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushParserQueue(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

async function loadParser(): Promise<typeof import('./parse.js')> {
  return import('./parse.js');
}

describe('parseNic', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.resetModules();
    dbState.domainsCollection.findOne.mockReset();
    dbState.domainsCollection.insertOne.mockReset();
    dbState.domainsCollection.updateOne.mockReset();
    dbState.oldDomainsCollection.insertOne.mockReset();
    dbState.collection.mockClear();
    dbState.getDb.mockClear();
    dbState.getWatchTerms.mockReset();
    dbState.getWatchTerms.mockResolvedValue(['bereke']);
    dbState.updateParserStatus.mockReset();
    requestMocks.getInstance.mockReset();
    botMocks.telegram.sendMessage.mockReset();
    whoisMocks.whoisAndParse.mockReset();
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('inserts a previously unseen domain and queues a Telegram send', async () => {
    dbState.domainsCollection.findOne.mockResolvedValue(null);
    whoisMocks.whoisAndParse.mockResolvedValue(parsedDomainData);
    const { parseNic } = await loadParser();

    await parseNic(axiosWithResult(Promise.resolve({ data: nicHtml })));
    await flushParserQueue();

    expect(dbState.domainsCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'example.kz',
        nicDate: '2026-06-24',
        whoisData: parsedDomainData.whoisData,
        whois: parsedDomainData.parsedData,
      }),
    );
    expect(botMocks.telegram.sendMessage).toHaveBeenCalledWith(
      'channel-id',
      expect.stringContaining('example\\.kz'),
      {
        parse_mode: 'MarkdownV2',
      },
    );
  });

  it('extracts domain rows from saved NIC fixture and ignores non-domain rows', async () => {
    dbState.domainsCollection.findOne.mockResolvedValue(null);
    whoisMocks.whoisAndParse.mockResolvedValue(parsedDomainData);
    const fixtureHtml = await readFile(fixtureUrl, 'utf8');
    const { parseNic } = await loadParser();

    await parseNic(axiosWithResult(Promise.resolve({ data: fixtureHtml })));
    await flushParserQueue();

    expect(dbState.domainsCollection.findOne).toHaveBeenCalledTimes(3);
    expect(dbState.domainsCollection.findOne).toHaveBeenNthCalledWith(1, {
      domain: 'alpha-example.kz',
    });
    expect(dbState.domainsCollection.findOne).toHaveBeenNthCalledWith(2, {
      domain: 'beta-example.kz',
    });
    expect(dbState.domainsCollection.findOne).toHaveBeenNthCalledWith(3, {
      domain: 'gamma-example.test',
    });
    expect(dbState.domainsCollection.insertOne).toHaveBeenCalledTimes(3);
    expect(dbState.domainsCollection.insertOne).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        domain: 'alpha-example.kz',
        nicDate: '2026-06-24 12:30',
      }),
    );
    expect(dbState.domainsCollection.insertOne).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        domain: 'beta-example.kz',
        nicDate: '2026-06-24 12:29',
      }),
    );
    expect(dbState.domainsCollection.insertOne).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        domain: 'gamma-example.test',
        nicDate: '2026-06-24 12:28',
      }),
    );
    expect(whoisMocks.whoisAndParse).toHaveBeenCalledTimes(3);
    expect(whoisMocks.whoisAndParse).not.toHaveBeenCalledWith(
      'registration rules',
      false,
    );
  });

  it('returns without domains when the NIC table is missing or empty', async () => {
    dbState.domainsCollection.findOne.mockResolvedValue(null);
    const { parseNic } = await loadParser();

    await parseNic(axiosWithResult(Promise.resolve({ data: '<main></main>' })));
    await parseNic(
      axiosWithResult(
        Promise.resolve({
          data: '<table id="last-ten-table"><tbody><tr></tr><tr><td><table><tbody></tbody></table></td></tr></tbody></table>',
        }),
      ),
    );
    await flushParserQueue();

    expect(dbState.domainsCollection.findOne).not.toHaveBeenCalled();
    expect(dbState.domainsCollection.insertOne).not.toHaveBeenCalled();
    expect(whoisMocks.whoisAndParse).not.toHaveBeenCalled();
    expect(botMocks.telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('skips an existing domain younger than 10 days', async () => {
    dbState.domainsCollection.findOne.mockResolvedValue({
      domain: 'example.kz',
      nicDate: '2026-06-24',
      date: Date.now(),
    });
    whoisMocks.whoisAndParse.mockResolvedValue(parsedDomainData);
    const { parseNic } = await loadParser();

    await parseNic(axiosWithResult(Promise.resolve({ data: nicHtml })));
    await flushParserQueue();

    expect(whoisMocks.whoisAndParse).not.toHaveBeenCalled();
    expect(dbState.domainsCollection.insertOne).not.toHaveBeenCalled();
    expect(dbState.domainsCollection.updateOne).not.toHaveBeenCalled();
    expect(botMocks.telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('alerts the owner for stale bereke domains when watch terms are missing', async () => {
    dbState.getWatchTerms.mockResolvedValue(['bereke']);
    dbState.domainsCollection.findOne.mockResolvedValue({
      _id: '000000000000000000000001',
      domain: 'bereke-example.kz',
      nicDate: '2026-06-10',
      date: Date.now() - 1000 * 60 * 60 * 24 * 11,
    });
    whoisMocks.whoisAndParse.mockResolvedValue(parsedDomainData);
    const { parseNic } = await loadParser();

    await parseNic(axiosWithResult(Promise.resolve({ data: nicHtmlFor('bereke-example.kz') })));
    await flushParserQueue();

    expect(dbState.getWatchTerms).toHaveBeenCalledTimes(1);
    expect(botMocks.telegram.sendMessage).toHaveBeenCalledWith(
      'owner-id',
      'Новый домен: bereke-example.kz',
      {
        parse_mode: 'Markdown',
      },
    );
  });

  it('alerts the owner for configured watch terms', async () => {
    dbState.getWatchTerms.mockResolvedValue(['acme']);
    dbState.domainsCollection.findOne.mockResolvedValue({
      _id: '000000000000000000000002',
      domain: 'new-acme.kz',
      nicDate: '2026-06-10',
      date: Date.now() - 1000 * 60 * 60 * 24 * 11,
    });
    whoisMocks.whoisAndParse.mockResolvedValue(parsedDomainData);
    const { parseNic } = await loadParser();

    await parseNic(axiosWithResult(Promise.resolve({ data: nicHtmlFor('new-acme.kz') })));
    await flushParserQueue();

    expect(botMocks.telegram.sendMessage).toHaveBeenCalledWith(
      'owner-id',
      'Новый домен: new-acme.kz',
      {
        parse_mode: 'Markdown',
      },
    );
  });

  it('does not alert the owner for unrelated domains', async () => {
    dbState.getWatchTerms.mockResolvedValue(['acme']);
    dbState.domainsCollection.findOne.mockResolvedValue({
      _id: '000000000000000000000003',
      domain: 'unrelated.kz',
      nicDate: '2026-06-10',
      date: Date.now() - 1000 * 60 * 60 * 24 * 11,
    });
    whoisMocks.whoisAndParse.mockResolvedValue(parsedDomainData);
    const { parseNic } = await loadParser();

    await parseNic(axiosWithResult(Promise.resolve({ data: nicHtmlFor('unrelated.kz') })));
    await flushParserQueue();

    expect(botMocks.telegram.sendMessage).not.toHaveBeenCalledWith(
      'owner-id',
      expect.any(String),
      expect.anything(),
    );
  });

  it('matches configured watch terms case-insensitively', async () => {
    dbState.getWatchTerms.mockResolvedValue(['ACME']);
    dbState.domainsCollection.findOne.mockResolvedValue({
      _id: '000000000000000000000004',
      domain: 'New-AcMe.kz',
      nicDate: '2026-06-10',
      date: Date.now() - 1000 * 60 * 60 * 24 * 11,
    });
    whoisMocks.whoisAndParse.mockResolvedValue(parsedDomainData);
    const { parseNic } = await loadParser();

    await parseNic(axiosWithResult(Promise.resolve({ data: nicHtmlFor('New-AcMe.kz') })));
    await flushParserQueue();

    expect(botMocks.telegram.sendMessage).toHaveBeenCalledWith(
      'owner-id',
      'Новый домен: New-AcMe.kz',
      {
        parse_mode: 'Markdown',
      },
    );
  });

  it('notifies the Telegram owner when fetching NIC fails', async () => {
    const { parseNic } = await loadParser();

    await parseNic(axiosWithResult(Promise.reject(new Error('network down'))));
    await flushParserQueue();

    expect(botMocks.telegram.sendMessage).toHaveBeenCalledWith('owner-id', 'network down', {
      parse_mode: 'Markdown',
    });
  });

  it('records parser start and success status with the scraped domain count', async () => {
    dbState.domainsCollection.findOne.mockResolvedValue(null);
    whoisMocks.whoisAndParse.mockResolvedValue(parsedDomainData);
    const { parseNic } = await loadParser();

    await parseNic(axiosWithResult(Promise.resolve({ data: nicHtml })));
    await flushParserQueue();

    expect(dbState.updateParserStatus).toHaveBeenNthCalledWith(1, {
      lastStartedAt: expect.any(Number),
    });
    expect(dbState.updateParserStatus).toHaveBeenLastCalledWith({
      lastFinishedAt: expect.any(Number),
      lastSuccessAt: expect.any(Number),
      lastDomainCount: 1,
      lastError: undefined,
    });
  });

  it('records a shortened parser failure status without stack details', async () => {
    const error = new Error(`${'network down '.repeat(40)}http://user:secret@proxy.example:3128`);
    error.stack = 'SECRET_STACK_SHOULD_NOT_BE_STORED';
    const { parseNic } = await loadParser();

    await parseNic(axiosWithResult(Promise.reject(error)));
    await flushParserQueue();

    expect(dbState.updateParserStatus).toHaveBeenNthCalledWith(1, {
      lastStartedAt: expect.any(Number),
    });
    const failureStatus = dbState.updateParserStatus.mock.calls.at(-1)?.[0];
    expect(failureStatus).toEqual({
      lastFinishedAt: expect.any(Number),
      lastError: expect.any(String),
    });
    expect(failureStatus.lastError.length).toBeLessThanOrEqual(240);
    expect(failureStatus.lastError).toContain('network down');
    expect(failureStatus.lastError).not.toContain('SECRET_STACK_SHOULD_NOT_BE_STORED');
    expect(failureStatus.lastError).not.toContain('secret');
  });

  it('awaits fetch, Mongo, WHOIS, and Telegram work before resolving', async () => {
    const fetchDeferred = deferred<{ data: string }>();
    const telegramDeferred = deferred<void>();
    const fakeAxios = axiosWithResult(fetchDeferred.promise);
    dbState.domainsCollection.findOne.mockResolvedValue(null);
    whoisMocks.whoisAndParse.mockResolvedValue(parsedDomainData);
    botMocks.telegram.sendMessage.mockReturnValue(telegramDeferred.promise);
    const { parseNic } = await loadParser();
    const onResolved = vi.fn();

    const parserPromise = parseNic(fakeAxios).then(onResolved);
    await vi.waitFor(() => expect(fakeAxios.get).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    await Promise.resolve();

    expect(onResolved).not.toHaveBeenCalled();

    fetchDeferred.resolve({ data: nicHtml });
    await vi.waitFor(() => expect(botMocks.telegram.sendMessage).toHaveBeenCalledTimes(1));
    expect(dbState.domainsCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'example.kz' }),
    );
    expect(whoisMocks.whoisAndParse).toHaveBeenCalledWith('example.kz', false);
    expect(onResolved).not.toHaveBeenCalled();

    telegramDeferred.resolve();
    await parserPromise;

    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it('catches and logs Telegram send rejections from domain notifications', async () => {
    dbState.domainsCollection.findOne.mockResolvedValue(null);
    whoisMocks.whoisAndParse.mockResolvedValue(parsedDomainData);
    botMocks.telegram.sendMessage.mockRejectedValue(new Error('telegram down'));
    const { parseNic } = await loadParser();

    await parseNic(axiosWithResult(Promise.resolve({ data: nicHtml })));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[PARSER] insert error',
      expect.objectContaining({ message: 'telegram down' }),
    );
  });

  it('joins concurrent parser calls and runs the core workflow once', async () => {
    const fetchDeferred = deferred<{ data: string }>();
    const fakeAxios = axiosWithResult(fetchDeferred.promise);
    dbState.domainsCollection.findOne.mockResolvedValue(null);
    whoisMocks.whoisAndParse.mockResolvedValue(parsedDomainData);
    botMocks.telegram.sendMessage.mockResolvedValue(undefined);
    const { parseNic } = await loadParser();

    const firstRun = parseNic(fakeAxios);
    await vi.waitFor(() => expect(fakeAxios.get).toHaveBeenCalledTimes(1));

    const secondRun = parseNic(fakeAxios);
    await Promise.resolve();
    await Promise.resolve();

    expect(fakeAxios.get).toHaveBeenCalledTimes(1);

    fetchDeferred.resolve({ data: nicHtml });
    await Promise.all([firstRun, secondRun]);

    expect(dbState.domainsCollection.findOne).toHaveBeenCalledTimes(1);
    expect(whoisMocks.whoisAndParse).toHaveBeenCalledTimes(1);
    expect(dbState.domainsCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(botMocks.telegram.sendMessage).toHaveBeenCalledTimes(1);
  });
});
