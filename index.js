require('dotenv').config();

const cron = require('node-cron');
const Telegraf = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

const { db, settingsDb } = require('./db');
const { parseNic } = require('./parse');

// setup DB defaults
db.defaults({ domains: [] })
  .write();

settingsDb.defaults({
  proxy: '',
}).write();

parseNic();

cron.schedule('*/5 * * * *', () => parseNic()).start();

module.exports = {
  bot,
};
