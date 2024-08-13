require('dotenv').config();

const cron = require('node-cron');

const { setupDb } = require('./db');
const { parseNic } = require('./parse');
const bot = require('./bot');
const {
  initAxios,
} = require('./request');

const init = async () => {
  try {
    await setupDb();
    await bot.startPolling();
    console.log('🚀 ~ [BOT] ready 🟢');
    await initAxios();

    parseNic();
  } catch (error) {
    console.error('🚀 ~ init ~ error', error);
  }
};

init();

// Run every 5 minutes
cron.schedule('*/5 * * * *', () => parseNic()).start();
