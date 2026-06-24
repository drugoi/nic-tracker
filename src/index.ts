import './polyfill-streams.js';
import 'dotenv/config';

import cron from 'node-cron';

import { launchBot } from './bot.js';
import { setupDb } from './db.js';
import { parseNic } from './parse.js';
import { initAxios } from './request.js';

async function runParser(): Promise<void> {
  try {
    await parseNic();
  } catch (error) {
    console.error('[PARSER] run error', error);
  }
}

async function init(): Promise<void> {
  try {
    await setupDb();
    await launchBot();
    await initAxios();

    void runParser();
  } catch (error) {
    console.error('init error', error);
  }
}

void init();

cron.schedule('*/5 * * * *', () => {
  void runParser();
}).start();
