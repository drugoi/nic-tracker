import { beforeEach, describe, expect, it, vi } from 'vitest';

interface TestMessage {
  text: string;
  entities?: { type: string }[];
}

interface TestContext {
  message?: TestMessage;
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
}));
const parseMocks = vi.hoisted(() => ({
  parseNic: vi.fn(),
}));
const whoisMocks = vi.hoisted(() => ({
  whoisAndParse: vi.fn(),
}));

vi.mock('./bot-setup.js', () => ({
  bot: botMocks,
}));

vi.mock('./db.js', () => dbMocks);

vi.mock('./request.js', () => requestMocks);

vi.mock('./parse.js', () => parseMocks);

vi.mock('./whois.js', () => whoisMocks);

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
    parseMocks.parseNic.mockReset();
    whoisMocks.whoisAndParse.mockReset();
  });

  it('updates proxy URL and starts parsing with a refreshed instance', async () => {
    const axiosInstance = { name: 'axios-instance' };
    requestMocks.getInstance.mockResolvedValue(axiosInstance);
    const handler = await loadHandler('proxy');
    const ctx: TestContext = {
      message: {
        text: '/proxy http://proxy.example:8080',
        entities: [{ type: 'url' }],
      },
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(dbMocks.updateSettings).toHaveBeenCalledWith('http://proxy.example:8080');
    expect(ctx.reply).toHaveBeenCalledWith('URL прокси успешно изменён');
    expect(requestMocks.getInstance).toHaveBeenCalledOnce();
    expect(parseMocks.parseNic).toHaveBeenCalledWith(axiosInstance);
  });

  it('disables proxy and starts parsing with a refreshed instance', async () => {
    const axiosInstance = { name: 'axios-instance' };
    requestMocks.getInstance.mockResolvedValue(axiosInstance);
    const handler = await loadHandler('disableproxy');
    const ctx: TestContext = {
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(dbMocks.updateSettings).toHaveBeenCalledWith('');
    expect(ctx.reply).toHaveBeenCalledWith('Прокси успешно отключена');
    expect(requestMocks.getInstance).toHaveBeenCalledOnce();
    expect(parseMocks.parseNic).toHaveBeenCalledWith(axiosInstance);
  });

  it('replies with the configured proxy URL', async () => {
    const findOne = vi.fn().mockResolvedValue({ proxy: 'http://proxy.example:3128' });
    const collection = vi.fn(() => ({ findOne }));
    dbMocks.getDb.mockResolvedValue({ collection });
    const handler = await loadHandler('getproxy');
    const ctx: TestContext = {
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(collection).toHaveBeenCalledWith('settings');
    expect(findOne).toHaveBeenCalledWith({});
    expect(ctx.reply).toHaveBeenCalledWith('http://proxy.example:3128');
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
