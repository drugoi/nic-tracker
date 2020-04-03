const Telegraf = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command('/start', (ctx) => {
  ctx.reply(
    'Добро пожаловать в бот, который следит за доменами в Казнете.\nАвтор: @drugoi',
  );
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
