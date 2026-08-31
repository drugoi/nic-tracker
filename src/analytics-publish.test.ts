import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const analyticsMocks = vi.hoisted(() => {
  const aggregate = vi.fn();
  const countDocuments = vi.fn();
  const collection = vi.fn(() => ({ aggregate, countDocuments }));

  return {
    aggregate,
    bot: { telegram: { sendMessage: vi.fn() } },
    collection,
    countDocuments,
    getDb: vi.fn(async () => ({ collection })),
  };
});

vi.mock('./bot-setup.js', () => ({
  bot: analyticsMocks.bot,
}));

vi.mock('./db.js', () => ({
  getDb: analyticsMocks.getDb,
}));

vi.mock('./env.js', () => ({
  env: {
    tgChannelId: 'channel-id',
  },
}));

import {
  publishDailyReport,
  publishMonthlyReport,
} from './analytics.js';

function aggregateResult(value: unknown) {
  return {
    toArray: vi.fn().mockResolvedValue([value]),
  };
}

describe('analytics publication', () => {
  beforeEach(() => {
    analyticsMocks.aggregate.mockReset();
    analyticsMocks.bot.telegram.sendMessage.mockReset();
    analyticsMocks.collection.mockClear();
    analyticsMocks.countDocuments.mockReset();
    analyticsMocks.getDb.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('publishes the daily summary to the configured channel', async () => {
    analyticsMocks.aggregate.mockReturnValue(aggregateResult({
      total: [{ domains: 71 }],
      peakHour: [{ hour: 11, domains: 11 }],
      topRegistrars: [
        { registrar: 'HOSTER.KZ', domains: 38 },
        { registrar: 'ICPS', domains: 28 },
      ],
    }));

    await publishDailyReport('30.08.2026');

    expect(analyticsMocks.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: {
            $or: [
              { nicDate: '30.08.2026' },
              { nicDate: { $regex: /^2026-08-30(?:$|[ T])/ } },
            ],
          },
        },
      ]),
    );
    expect(analyticsMocks.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $unionWith: expect.objectContaining({ coll: 'oldDomains' }),
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            reportDay: expect.any(Object),
          }),
        }),
      ]),
    );
    expect(analyticsMocks.bot.telegram.sendMessage).toHaveBeenCalledWith(
      'channel-id',
      expect.stringContaining('*Новых доменов:* 71'),
      { parse_mode: 'MarkdownV2' },
    );
    expect(analyticsMocks.bot.telegram.sendMessage).toHaveBeenCalledWith(
      'channel-id',
      expect.stringContaining('HOSTER\\.KZ'),
      { parse_mode: 'MarkdownV2' },
    );
  });

  it('publishes the monthly summary with the prior-year comparison', async () => {
    analyticsMocks.aggregate.mockReturnValue(aggregateResult({
      total: [{ domains: 5106 }],
      busiestDay: [{ nicDate: '21.07.2026', domains: 270 }],
      topRegistrars: [
        { registrar: 'ICPS', domains: 2553 },
        { registrar: 'HOSTER.KZ', domains: 1740 },
      ],
    }));
    analyticsMocks.countDocuments
      .mockResolvedValueOnce(3955)
      .mockResolvedValueOnce(0);

    await publishMonthlyReport({ year: 2026, month: 7 });

    expect(analyticsMocks.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: {
            $or: [
              {
                nicDate: {
                  $in: expect.arrayContaining(['01.07.2026', '31.07.2026']),
                },
              },
              { nicDate: { $regex: /^2026-07(?:$|[ T-])/ } },
            ],
          },
        },
      ]),
    );
    expect(analyticsMocks.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $unionWith: expect.objectContaining({ coll: 'oldDomains' }),
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            reportDay: expect.any(Object),
          }),
        }),
      ]),
    );
    expect(analyticsMocks.bot.telegram.sendMessage).toHaveBeenCalledWith(
      'channel-id',
      expect.stringContaining('*Год к году:* +29,1%'),
      { parse_mode: 'MarkdownV2' },
    );
    expect(analyticsMocks.bot.telegram.sendMessage).toHaveBeenCalledWith(
      'channel-id',
      expect.stringContaining('21 июля — 270 доменов'),
      { parse_mode: 'MarkdownV2' },
    );
  });
});
