const Telegraf = require('telegraf');
const { settingsDb } = require('./db');


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
  } else {
    await reply('Нужно указать URL для прокси');
  }
});

// bot.hears('/domains', ({replyWithMarkdown}))

// bot.on('text', ({ message, replyWithMarkdown }) => {
//   const reply = `${transformString(message.text)}`;
//   replyWithMarkdown(reply);
// });

// bot.on('inline_query', ({ inlineQuery, answerInlineQuery }) => {
//   if (inlineQuery.query && inlineQuery.query.length) {
//     const answer = transformString(inlineQuery.query);
//     answerInlineQuery([
//       {
//         id: '1',
//         type: 'article',
//         title: answer,
//         input_message_content: {
//           message_text: `${answer}`,
//           parse_mode: 'Markdown',
//           disable_web_page_preview: true,
//         },
//       },
//     ]);
//   }
// });

bot.startPolling();

module.exports = bot;
