import { describe, expect, it, vi } from 'vitest';

vi.mock('./bot-setup.js', () => ({
  bot: { telegram: { sendMessage: vi.fn() } },
}));

vi.mock('./db.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('./env.js', () => ({
  env: { tgChannelId: 'channel-id' },
}));

import {
  formatDailyReport,
  formatMonthlyReport,
  previousAlmatyDay,
  previousAlmatyMonth,
} from './analytics.js';

describe('formatDailyReport', () => {
  it('formats the daily activity summary for Telegram MarkdownV2', () => {
    expect(formatDailyReport({
      nicDate: '30.08.2026',
      total: 71,
      peakHour: { hour: 11, domains: 11 },
      topRegistrars: [
        { registrar: 'HOSTER.KZ', domains: 38 },
        { registrar: 'ICPS', domains: 28 },
        { registrar: 'UNIHOST', domains: 4 },
      ],
    })).toBe(
      '📊 *Итоги дня — 30 августа*\n\n'
      + '*Новых доменов:* 71\n'
      + '*Пиковый час:* 11:00–12:00 \\(11 доменов\\)\n\n'
      + '*Топ регистраторов:*\n'
      + '1\\. HOSTER\\.KZ — 38\n'
      + '2\\. ICPS — 28\n'
      + '3\\. UNIHOST — 4',
    );
  });
});

describe('formatMonthlyReport', () => {
  it('formats the completed month with year-over-year growth', () => {
    expect(formatMonthlyReport({
      year: 2026,
      month: 7,
      total: 5106,
      priorYearTotal: 3955,
      busiestDay: { nicDate: '21.07.2026', domains: 270 },
      topRegistrars: [
        { registrar: 'ICPS', domains: 2553 },
        { registrar: 'HOSTER.KZ', domains: 1740 },
        { registrar: 'RSSOLUTIONS', domains: 460 },
      ],
    })).toBe(
      '📈 *Итоги июля 2026*\n\n'
      + '*Новых доменов:* 5 106\n'
      + '*Год к году:* +29,1% \\(июль 2025: 3 955\\)\n'
      + '*Самый активный день:* 21 июля — 270 доменов\n\n'
      + '*Топ регистраторов:*\n'
      + '1\\. ICPS — 2 553\n'
      + '2\\. HOSTER\\.KZ — 1 740\n'
      + '3\\. RSSOLUTIONS — 460',
    );
  });
});

describe('Almaty reporting periods', () => {
  it('selects the preceding calendar day in Almaty', () => {
    expect(previousAlmatyDay(new Date('2026-08-31T19:05:00.000Z'))).toBe('31.08.2026');
  });

  it('selects the completed month in Almaty', () => {
    expect(previousAlmatyMonth(new Date('2026-08-31T19:10:00.000Z'))).toEqual({
      year: 2026,
      month: 8,
    });
  });
});
