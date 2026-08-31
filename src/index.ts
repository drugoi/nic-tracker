import './polyfill-streams.js';
import 'dotenv/config';

import cron from 'node-cron';

import { launchBot } from './bot.js';
import { setupDb } from './db.js';
import { runExclusively } from './execution-queue.js';
import {
  previousAlmatyDay,
  previousAlmatyMonth,
  publishDailyReport,
  publishMonthlyReport,
} from './analytics.js';
import { parseNic } from './parse.js';
import { initAxios } from './request.js';

async function runParser(): Promise<void> {
  try {
    await runExclusively(() => parseNic());
  } catch (error) {
    console.error('[PARSER] run error', error);
  }
}

async function runDailyReport(): Promise<void> {
  try {
    await runExclusively(() => publishDailyReport(previousAlmatyDay(new Date())));
  } catch (error) {
    console.error('[ANALYTICS] daily report error', error);
  }
}

async function runMonthlyReport(): Promise<void> {
  try {
    await runExclusively(() => publishMonthlyReport(previousAlmatyMonth(new Date())));
  } catch (error) {
    console.error('[ANALYTICS] monthly report error', error);
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

cron.schedule('2 0 * * *', () => {
  void runDailyReport();
}, {
  timezone: 'Asia/Almaty',
}).start();

cron.schedule('7 0 1 * *', () => {
  void runMonthlyReport();
}, {
  timezone: 'Asia/Almaty',
}).start();
