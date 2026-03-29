import { Telegraf } from 'telegraf';

import { env } from './env.js';

export const bot = new Telegraf(env.botToken);
