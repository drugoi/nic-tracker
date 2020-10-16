const Telegraf = require('telegraf');
const { settingsDb } = require('./db');
const { parseNic } = require('./parse');
const whoisAndParse = require('./whois');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command('/start', (ctx) => {
  ctx.reply(
    'Добро пожаловать в бот, который следит за доменами в Казнете.\nАвтор: @drugoi',
  );
});

bot.command('/proxy', async ({ message, reply }) => {
  if (message.entities.some((entity) => entity.type === 'url')) {
    const proxyUrl = message.text.replace('/proxy ', '');
    await settingsDb.set('proxy', proxyUrl).write();
    await reply('URL прокси успешно изменён');

    parseNic();
  } else {
    await reply('Нужно указать URL для прокси');
  }
});

bot.command('/whois', async ({ message, reply }) => {
  console.log(message);
  const domain = message.text.replace('/whois', '');
  if (domain) {
    whoisAndParse(domain, true).then(async (res) => {
      await reply(res);
    });
  } else {
    await reply('Нужно указать домен в формате domain.com');
  }
});

bot.startPolling();

module.exports = bot;
