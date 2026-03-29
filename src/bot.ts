import { bot } from './bot-setup.js';
import { updateSettings, getDb } from './db.js';
import { whoisAndParse } from './whois.js';
import { parseNic } from './parse.js';
import { getInstance } from './request.js';

bot.catch((err, ctx) => {
  console.error(`bot.catch ${ctx.updateType}`, err);
});

bot.command('start', (ctx) => {
  ctx.reply(
    'Добро пожаловать в бот, который следит за доменами в Казнете.\nАвтор: @drugoi',
  );
});

bot.command('proxy', async (ctx) => {
  const { message } = ctx;
  if (!message || !('text' in message)) {
    return;
  }
  if (message.entities?.some((entity) => entity.type === 'url')) {
    const proxyUrl = message.text.replace('/proxy ', '');
    await updateSettings(proxyUrl);
    await ctx.reply('URL прокси успешно изменён');
    const instance = await getInstance();
    parseNic(instance);
  } else {
    await ctx.reply('Нужно указать URL для прокси');
  }
});

bot.command('disableproxy', async (ctx) => {
  await updateSettings('');
  await ctx.reply('Прокси успешно отключена');
  const instance = await getInstance();
  parseNic(instance);
});

bot.command('getproxy', async (ctx) => {
  const database = await getDb();
  const doc = await database.collection('settings').findOne({});
  const proxyUrl = doc && typeof doc.proxy === 'string' ? doc.proxy : undefined;
  await ctx.reply(proxyUrl || 'Прокси не установлена');
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
