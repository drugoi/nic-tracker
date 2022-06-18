require('dotenv').config();

const cron = require('node-cron');

const { setupDb } = require('./db');
const { parseNic, db } = require('./parse');
const bot = require('./bot');
const {
  initAxios,
} = require('./request');

const init = async () => {
  try {
    const localDb = await setupDb();
    await bot.startPolling();
    console.log('🚀 ~ [BOT] ready 🟢');
    const requestInstance = await initAxios(localDb);

    parseNic(requestInstance, localDb);
  } catch (error) {
    console.error('🚀 ~ init ~ error', error);
  }
};

init();

cron.schedule('*/5 * * * *', () => parseNic(db)).start();
