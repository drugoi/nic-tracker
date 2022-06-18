const { bot } = require('./bot-setup');
const { updateSettings } = require('./db');
const whoisAndParse = require('./whois');
const { parseNic } = require('./parse');
const {
  instance,
} = require('./request');

bot.catch((err, ctx) => {
  console.error(`🚀 ~ bot.catch ~ err for ${ctx.updateType}`, err);
});

bot.command('/start', (ctx) => {
  ctx.reply(
    'Добро пожаловать в бот, который следит за доменами в Казнете.\nАвтор: @drugoi',
  );
});

bot.command('/proxy', async ({ message, reply }) => {
  if (message.entities.some((entity) => entity.type === 'url')) {
    const proxyUrl = message.text.replace('/proxy ', '');
    await updateSettings(proxyUrl);
    await reply('URL прокси успешно изменён');

    parseNic(instance);
  } else {
    await reply('Нужно указать URL для прокси');
  }
});

bot.command('/disableproxy', async ({ reply }) => {
  await updateSettings('');
  await reply('Прокси успешно отключена');

  parseNic(instance);
});

bot.command('/whois', async ({ message, reply }) => {
  const domain = message.text.replace('/whois', '');
  if (domain) {
    const whoisData = await whoisAndParse(domain, true);
    await reply(whoisData);
  } else {
    await reply('Нужно указать домен в формате domain.com');
  }
});

module.exports = bot;
