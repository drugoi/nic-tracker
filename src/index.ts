import 'dotenv/config';

import cron from 'node-cron';

import { launchBot } from './bot.js';
import { setupDb } from './db.js';
import { parseNic } from './parse.js';
import { initAxios } from './request.js';

async function init(): Promise<void> {
  try {
    await setupDb();
    await launchBot();
    console.log('🚀 ~ [BOT] ready 🟢');
    await initAxios();

    void parseNic();
  } catch (error) {
    console.error('🚀 ~ init ~ error', error);
  }
}

void init();

cron.schedule('*/5 * * * *', () => {
  void parseNic();
}).start();
