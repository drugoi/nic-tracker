import { beforeEach, describe, expect, it, vi } from 'vitest';

interface TestMessage {
  text: string;
  entities?: { type: string }[];
}

interface TestContext {
  message?: TestMessage;
  from?: { id: number };
  reply: ReturnType<typeof vi.fn>;
}

type CommandHandler = (ctx: TestContext) => Promise<void> | void;

const commandHandlers = vi.hoisted(() => new Map<string, CommandHandler>());
const botMocks = vi.hoisted(() => ({
  catch: vi.fn(),
  command: vi.fn((name: string, handler: CommandHandler) => {
    commandHandlers.set(name, handler);
  }),
  launch: vi.fn(),
  stop: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({
  addWatchTerm: vi.fn(),
  getDb: vi.fn(),
  getStatus: vi.fn(),
  getWatchTerms: vi.fn(),
  removeWatchTerm: vi.fn(),
  updateSettings: vi.fn(),
}));
const requestMocks = vi.hoisted(() => ({
  getInstance: vi.fn(),
  refreshAxios: vi.fn(),
}));
const parseMocks = vi.hoisted(() => ({
  parseNic: vi.fn(),
}));
const whoisMocks = vi.hoisted(() => ({
  whoisAndParse: vi.fn(),
}));
const envMocks = vi.hoisted(() => ({
  tgOwnerId: '1001',
}));

vi.mock('./bot-setup.js', () => ({
  bot: botMocks,
}));

vi.mock('./db.js', () => dbMocks);

vi.mock('./request.js', () => requestMocks);

vi.mock('./parse.js', () => parseMocks);

vi.mock('./whois.js', () => whoisMocks);

vi.mock('./env.js', () => ({
  env: envMocks,
}));

async function loadHandler(command: string): Promise<CommandHandler> {
  await import('./bot.js');
  const handler = commandHandlers.get(command);
  if (!handler) {
    throw new Error(`Command handler ${command} was not registered`);
  }
  return handler;
}

describe('bot commands', () => {
  beforeEach(() => {
    vi.resetModules();
    commandHandlers.clear();
    botMocks.catch.mockClear();
    botMocks.command.mockClear();
    botMocks.launch.mockClear();
    botMocks.stop.mockClear();
    dbMocks.addWatchTerm.mockReset();
    dbMocks.getDb.mockReset();
    dbMocks.getStatus.mockReset();
    dbMocks.getWatchTerms.mockReset();
    dbMocks.removeWatchTerm.mockReset();
    dbMocks.updateSettings.mockReset();
    requestMocks.getInstance.mockReset();
    requestMocks.refreshAxios.mockReset();
    parseMocks.parseNic.mockReset();
    whoisMocks.whoisAndParse.mockReset();
  });

  it('updates proxy URL and starts parsing with a refreshed instance', async () => {
    const axiosInstance = { name: 'refreshed-axios-instance' };
    requestMocks.refreshAxios.mockResolvedValue(axiosInstance);
    const handler = await loadHandler('proxy');
    const ctx: TestContext = {
      from: { id: 1001 },
      message: {
        text: '/proxy http://proxy.example:8080',
        entities: [{ type: 'url' }],
      },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(dbMocks.updateSettings).toHaveBeenCalledWith('http://proxy.example:8080');
    expect(ctx.reply).toHaveBeenCalledWith('URL прокси успешно изменён');
    expect(requestMocks.refreshAxios).toHaveBeenCalledOnce();
    expect(requestMocks.getInstance).not.toHaveBeenCalled();
    expect(parseMocks.parseNic).toHaveBeenCalledWith(axiosInstance);
  });

  it('disables proxy and starts parsing with a refreshed instance', async () => {
    const axiosInstance = { name: 'refreshed-axios-instance' };
    requestMocks.refreshAxios.mockResolvedValue(axiosInstance);
    const handler = await loadHandler('disableproxy');
    const ctx: TestContext = {
      from: { id: 1001 },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(dbMocks.updateSettings).toHaveBeenCalledWith('');
    expect(ctx.reply).toHaveBeenCalledWith('Прокси успешно отключена');
    expect(requestMocks.refreshAxios).toHaveBeenCalledOnce();
    expect(requestMocks.getInstance).not.toHaveBeenCalled();
    expect(parseMocks.parseNic).toHaveBeenCalledWith(axiosInstance);
  });

  it('replies with the configured proxy URL', async () => {
    const findOne = vi.fn().mockResolvedValue({ proxy: 'http://proxy.example:3128' });
    const collection = vi.fn(() => ({ findOne }));
    dbMocks.getDb.mockResolvedValue({ collection });
    const handler = await loadHandler('getproxy');
    const ctx: TestContext = {
      from: { id: 1001 },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(collection).toHaveBeenCalledWith('settings');
    expect(findOne).toHaveBeenCalledWith({});
    expect(ctx.reply).toHaveBeenCalledWith('http://proxy.example:3128');
  });

  it('rejects proxy URL updates from non-owner users', async () => {
    const handler = await loadHandler('proxy');
    const ctx: TestContext = {
      from: { id: 2002 },
      message: {
        text: '/proxy http://proxy.example:8080',
        entities: [{ type: 'url' }],
      },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(ctx.reply).toHaveBeenCalledWith('Недостаточно прав');
    expect(dbMocks.updateSettings).not.toHaveBeenCalled();
    expect(dbMocks.getDb).not.toHaveBeenCalled();
    expect(requestMocks.getInstance).not.toHaveBeenCalled();
    expect(requestMocks.refreshAxios).not.toHaveBeenCalled();
    expect(parseMocks.parseNic).not.toHaveBeenCalled();
  });

  it('rejects proxy disabling from non-owner users', async () => {
    const handler = await loadHandler('disableproxy');
    const ctx: TestContext = {
      from: { id: 2002 },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(ctx.reply).toHaveBeenCalledWith('Недостаточно прав');
    expect(dbMocks.updateSettings).not.toHaveBeenCalled();
    expect(dbMocks.getDb).not.toHaveBeenCalled();
    expect(requestMocks.getInstance).not.toHaveBeenCalled();
    expect(requestMocks.refreshAxios).not.toHaveBeenCalled();
    expect(parseMocks.parseNic).not.toHaveBeenCalled();
  });

  it('rejects proxy reads from non-owner users', async () => {
    const handler = await loadHandler('getproxy');
    const ctx: TestContext = {
      from: { id: 2002 },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(ctx.reply).toHaveBeenCalledWith('Недостаточно прав');
    expect(dbMocks.updateSettings).not.toHaveBeenCalled();
    expect(dbMocks.getDb).not.toHaveBeenCalled();
    expect(requestMocks.getInstance).not.toHaveBeenCalled();
    expect(requestMocks.refreshAxios).not.toHaveBeenCalled();
    expect(parseMocks.parseNic).not.toHaveBeenCalled();
  });

  it('lists configured watch terms for the owner', async () => {
    dbMocks.getWatchTerms.mockResolvedValue(['bereke', 'acme']);
    const handler = await loadHandler('watchterms');
    const ctx: TestContext = {
      from: { id: 1001 },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(dbMocks.getWatchTerms).toHaveBeenCalledOnce();
    expect(ctx.reply).toHaveBeenCalledWith('Отслеживаемые термины: bereke, acme');
  });

  it('adds a watch term for the owner', async () => {
    dbMocks.addWatchTerm.mockResolvedValue(['bereke', 'acme']);
    const handler = await loadHandler('addwatchterm');
    const ctx: TestContext = {
      from: { id: 1001 },
      message: {
        text: '/addwatchterm acme',
      },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(dbMocks.addWatchTerm).toHaveBeenCalledWith('acme');
    expect(ctx.reply).toHaveBeenCalledWith('Отслеживаемые термины: bereke, acme');
  });

  it('rejects add watch term without a term', async () => {
    const handler = await loadHandler('addwatchterm');
    const ctx: TestContext = {
      from: { id: 1001 },
      message: {
        text: '/addwatchterm',
      },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(dbMocks.addWatchTerm).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Нужно указать термин');
  });

  it('removes a watch term for the owner', async () => {
    dbMocks.removeWatchTerm.mockResolvedValue(['acme']);
    const handler = await loadHandler('removewatchterm');
    const ctx: TestContext = {
      from: { id: 1001 },
      message: {
        text: '/removewatchterm bereke',
      },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(dbMocks.removeWatchTerm).toHaveBeenCalledWith('bereke');
    expect(ctx.reply).toHaveBeenCalledWith('Отслеживаемые термины: acme');
  });

  it('replies to the owner with parser status and a redacted enabled proxy', async () => {
    const findOne = vi.fn().mockResolvedValue({
      proxy: 'http://user:secret@proxy.example:3128/private',
    });
    const collection = vi.fn(() => ({ findOne }));
    dbMocks.getDb.mockResolvedValue({ collection });
    dbMocks.getStatus.mockResolvedValue({
      lastStartedAt: Date.UTC(2026, 5, 24, 6, 0, 0),
      lastFinishedAt: Date.UTC(2026, 5, 24, 6, 1, 0),
      lastSuccessAt: Date.UTC(2026, 5, 24, 6, 1, 0),
      lastError: 'network timeout while fetching NIC data',
      lastDomainCount: 3,
    });
    const handler = await loadHandler('status');
    const ctx: TestContext = {
      from: { id: 1001 },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(collection).toHaveBeenCalledWith('settings');
    expect(findOne).toHaveBeenCalledWith({});
    expect(dbMocks.getStatus).toHaveBeenCalledOnce();
    expect(ctx.reply).toHaveBeenCalledOnce();
    const reply = ctx.reply.mock.calls[0]?.[0] as string;
    expect(reply).toContain('Last started: 2026-06-24T06:00:00.000Z');
    expect(reply).toContain('Last finished: 2026-06-24T06:01:00.000Z');
    expect(reply).toContain('Last success: 2026-06-24T06:01:00.000Z');
    expect(reply).toContain('Last domain count: 3');
    expect(reply).toContain('Last error: network timeout while fetching NIC data');
    expect(reply).toContain('Proxy: enabled (http://proxy.example:3128)');
    expect(reply).not.toContain('user');
    expect(reply).not.toContain('secret');
    expect(reply).not.toContain('/private');
  });

  it('rejects watch term listing from non-owner users', async () => {
    const handler = await loadHandler('watchterms');
    const ctx: TestContext = {
      from: { id: 2002 },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(ctx.reply).toHaveBeenCalledWith('Недостаточно прав');
    expect(dbMocks.getWatchTerms).not.toHaveBeenCalled();
  });

  it('rejects status reads from non-owner users', async () => {
    const handler = await loadHandler('status');
    const ctx: TestContext = {
      from: { id: 2002 },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(ctx.reply).toHaveBeenCalledWith('Недостаточно прав');
    expect(dbMocks.getStatus).not.toHaveBeenCalled();
    expect(dbMocks.getDb).not.toHaveBeenCalled();
  });

  it('rejects watch term updates from non-owner users', async () => {
    const addHandler = await loadHandler('addwatchterm');
    const removeHandler = await loadHandler('removewatchterm');
    const addCtx: TestContext = {
      from: { id: 2002 },
      message: {
        text: '/addwatchterm acme',
      },
      reply: vi.fn(),
    };
    const removeCtx: TestContext = {
      from: { id: 2002 },
      message: {
        text: '/removewatchterm acme',
      },
      reply: vi.fn(),
    };

    await addHandler(addCtx);
    await removeHandler(removeCtx);

    expect(addCtx.reply).toHaveBeenCalledWith('Недостаточно прав');
    expect(removeCtx.reply).toHaveBeenCalledWith('Недостаточно прав');
    expect(dbMocks.addWatchTerm).not.toHaveBeenCalled();
    expect(dbMocks.removeWatchTerm).not.toHaveBeenCalled();
  });

  it('replies with full WHOIS data for the requested domain', async () => {
    whoisMocks.whoisAndParse.mockResolvedValue('raw whois data');
    const handler = await loadHandler('whois');
    const ctx: TestContext = {
      message: {
        text: '/whois example.kz',
      },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(whoisMocks.whoisAndParse).toHaveBeenCalledWith('example.kz', true);
    expect(ctx.reply).toHaveBeenCalledWith('raw whois data');
  });
});
