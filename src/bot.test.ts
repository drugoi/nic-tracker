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
  getDb: vi.fn(),
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
    dbMocks.getDb.mockReset();
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
