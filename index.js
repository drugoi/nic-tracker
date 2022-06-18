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
    const db = await setupDb();
    await bot.startPolling();
    console.log('🚀 ~ [BOT] ready 🟢');
    const requestInstance = await initAxios(db);

    parseNic(requestInstance, db);
  } catch (error) {
    console.error('🚀 ~ init ~ error', error);
  }
};

init();

// cron.schedule('*/5 * * * *', () => parseNic()).start();
