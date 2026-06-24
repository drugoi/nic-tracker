import { bot } from './bot-setup.js';
import { updateSettings, getDb, getStatus } from './db.js';
import { whoisAndParse } from './whois.js';
import { parseNic } from './parse.js';
import { refreshAxios } from './request.js';
import { env } from './env.js';

interface OwnerContext {
  from?: { id?: number | string };
  reply: (text: string) => Promise<unknown> | unknown;
}

async function ensureOwner(ctx: OwnerContext): Promise<boolean> {
  if (String(ctx.from?.id) === env.tgOwnerId) {
    return true;
  }

  await ctx.reply('Недостаточно прав');
  return false;
}

function formatStatusDate(value: number | undefined): string {
  return typeof value === 'number' ? new Date(value).toISOString() : 'never';
}

function shortenStatusText(value: string | undefined): string {
  if (!value) {
    return 'none';
  }
  return value.length <= 240 ? value : `${value.slice(0, 237)}...`;
}

function formatProxyStatus(proxyUrl: string | undefined): string {
  if (!proxyUrl) {
    return 'disabled';
  }

  try {
    const proxy = new URL(proxyUrl);
    const port = proxy.port ? `:${proxy.port}` : '';
    return `enabled (${proxy.protocol}//${proxy.hostname}${port})`;
  } catch {
    return 'enabled (redacted)';
  }
}

bot.catch((err, ctx) => {
  console.error(`bot.catch ${ctx.updateType}`, err);
});

bot.command('start', (ctx) => {
  ctx.reply(
    'Добро пожаловать в бот, который следит за доменами в Казнете.\nАвтор: @drugoi',
  );
});

bot.command('proxy', async (ctx) => {
  if (!(await ensureOwner(ctx))) {
    return;
  }

  const { message } = ctx;
  if (!message || !('text' in message)) {
    return;
  }
  if (message.entities?.some((entity) => entity.type === 'url')) {
    const proxyUrl = message.text.replace('/proxy ', '');
    await updateSettings(proxyUrl);
    await ctx.reply('URL прокси успешно изменён');
    const instance = await refreshAxios();
    parseNic(instance);
  } else {
    await ctx.reply('Нужно указать URL для прокси');
  }
});

bot.command('disableproxy', async (ctx) => {
  if (!(await ensureOwner(ctx))) {
    return;
  }

  await updateSettings('');
  await ctx.reply('Прокси успешно отключена');
  const instance = await refreshAxios();
  parseNic(instance);
});

bot.command('getproxy', async (ctx) => {
  if (!(await ensureOwner(ctx))) {
    return;
  }

  const database = await getDb();
  const doc = await database.collection('settings').findOne({});
  const proxyUrl = doc && typeof doc.proxy === 'string' ? doc.proxy : undefined;
  await ctx.reply(proxyUrl || 'Прокси не установлена');
});

bot.command('status', async (ctx) => {
  if (!(await ensureOwner(ctx))) {
    return;
  }

  const status = await getStatus();
  const database = await getDb();
  const doc = await database.collection('settings').findOne({});
  const proxyUrl = doc && typeof doc.proxy === 'string' ? doc.proxy : undefined;

  await ctx.reply([
    `Last started: ${formatStatusDate(status.lastStartedAt)}`,
    `Last finished: ${formatStatusDate(status.lastFinishedAt)}`,
    `Last success: ${formatStatusDate(status.lastSuccessAt)}`,
    `Last domain count: ${status.lastDomainCount ?? 'unknown'}`,
    `Last error: ${shortenStatusText(status.lastError)}`,
    `Proxy: ${formatProxyStatus(proxyUrl)}`,
  ].join('\n'));
});

bot.command('whois', async (ctx) => {
  try {
    const { message } = ctx;
    if (!message || !('text' in message)) {
      return;
    }
    const domain = message.text.replace('/whois', '').trim();
    if (domain) {
      const whoisData = await whoisAndParse(domain, true);
      await ctx.reply(typeof whoisData === 'string' ? whoisData : String(whoisData));
    } else {
      await ctx.reply('Нужно указать домен в формате domain.com');
    }
  } catch (error) {
    console.error('bot /whois error', error);
  }
});

export async function launchBot(): Promise<void> {
  await bot.launch();
  process.once('SIGINT', () => {
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
  });
}
