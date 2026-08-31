import { escapeMarkdown } from './helpers.js';
import { bot } from './bot-setup.js';
import { getDb } from './db.js';
import { env } from './env.js';
import type { DomainDoc } from './types.js';

export interface RegistrarStat {
  registrar: string;
  domains: number;
}

export interface DailyReport {
  nicDate: string;
  total: number;
  peakHour?: { hour: number; domains: number };
  topRegistrars: RegistrarStat[];
}

export interface MonthlyReport {
  year: number;
  month: number;
  total: number;
  priorYearTotal: number;
  busiestDay?: { nicDate: string; domains: number };
  topRegistrars: RegistrarStat[];
}

interface AnalyticsAggregate {
  total: Array<{ domains: number }>;
  peakHour?: Array<{ hour: number; domains: number }>;
  busiestDay?: Array<{ nicDate: string; domains: number }>;
  topRegistrars: RegistrarStat[];
}

const monthNames = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

const monthNamesNominative = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
] as const;

const almatyTimeZone = 'Asia/Almaty';

function almatyDateParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: almatyTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number.parseInt(part.value, 10)]),
  );

  return {
    year: values.year ?? now.getUTCFullYear(),
    month: values.month ?? now.getUTCMonth() + 1,
    day: values.day ?? now.getUTCDate(),
  };
}

export function previousAlmatyDay(now: Date): string {
  const { year, month, day } = almatyDateParts(now);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  const previousDay = String(previous.getUTCDate()).padStart(2, '0');
  const previousMonth = String(previous.getUTCMonth() + 1).padStart(2, '0');

  return `${previousDay}.${previousMonth}.${previous.getUTCFullYear()}`;
}

export function previousAlmatyMonth(now: Date): { year: number; month: number } {
  const { year, month } = almatyDateParts(now);

  return month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };
}

function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function getMonthName(month: number): string {
  return monthNames[month - 1] ?? String(month);
}

function getMonthNameNominative(month: number): string {
  return monthNamesNominative[month - 1] ?? String(month);
}

function formatDay(nicDate: string): string {
  const dottedMatch = /^(\d{2})\.(\d{2})\.\d{4}$/.exec(nicDate);
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(nicDate);
  const dayNumber = Number.parseInt(dottedMatch?.[1] ?? isoMatch?.[3] ?? '', 10);
  const monthNumber = Number.parseInt(dottedMatch?.[2] ?? isoMatch?.[2] ?? '', 10);

  if (Number.isNaN(dayNumber) || Number.isNaN(monthNumber)) {
    return escapeMarkdown(nicDate);
  }

  return `${dayNumber} ${getMonthName(monthNumber)}`;
}

function formatTopRegistrars(topRegistrars: RegistrarStat[]): string[] {
  if (topRegistrars.length === 0) {
    return [];
  }

  return [
    '*Топ регистраторов:*',
    ...topRegistrars.map(
      ({ registrar, domains }, index) => `${index + 1}\\. ${escapeMarkdown(registrar)} — ${formatNumber(domains)}`,
    ),
  ];
}

export function formatDailyReport({
  nicDate,
  total,
  peakHour,
  topRegistrars,
}: DailyReport): string {
  const lines = [
    `📊 *Итоги дня — ${formatDay(nicDate)}*`,
    '',
    `*Новых доменов:* ${formatNumber(total)}`,
  ];

  if (peakHour) {
    lines.push(
      `*Пиковый час:* ${String(peakHour.hour).padStart(2, '0')}:00–${String((peakHour.hour + 1) % 24).padStart(2, '0')}:00 \\(${formatNumber(peakHour.domains)} доменов\\)`,
    );
  }

  const registrarLines = formatTopRegistrars(topRegistrars);
  if (registrarLines.length > 0) {
    lines.push('', ...registrarLines);
  }

  return lines.join('\n');
}

export function formatMonthlyReport({
  year,
  month,
  total,
  priorYearTotal,
  busiestDay,
  topRegistrars,
}: MonthlyReport): string {
  const monthName = getMonthName(month);
  const lines = [
    `📈 *Итоги ${monthName} ${year}*`,
    '',
    `*Новых доменов:* ${formatNumber(total)}`,
  ];

  if (priorYearTotal > 0) {
    const yoy = ((total / priorYearTotal) - 1) * 100;
    const sign = yoy >= 0 ? '+' : '';
    const percent = yoy.toFixed(1).replace('.', ',');
    lines.push(
      `*Год к году:* ${sign}${percent}% \\(${getMonthNameNominative(month)} ${year - 1}: ${formatNumber(priorYearTotal)}\\)`,
    );
  }

  if (busiestDay) {
    lines.push(
      `*Самый активный день:* ${formatDay(busiestDay.nicDate)} — ${formatNumber(busiestDay.domains)} доменов`,
    );
  }

  const registrarLines = formatTopRegistrars(topRegistrars);
  if (registrarLines.length > 0) {
    lines.push('', ...registrarLines);
  }

  return lines.join('\n');
}

function registrarPipeline(): object[] {
  return [
    {
      $set: {
        registrarField: {
          $arrayElemAt: [
            {
              $filter: {
                input: { $ifNull: ['$whoisData', []] },
                as: 'field',
                cond: {
                  $regexMatch: {
                    input: '$$field.attribute',
                    regex: '^Current Regist(?:rar|ar)',
                    options: 'i',
                  },
                },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $set: {
        registrar: {
          $ifNull: ['$registrarField.value', '$whois.registrar'],
        },
      },
    },
    {
      $match: {
        registrar: { $type: 'string', $nin: ['', 'Не указан'] },
      },
    },
    { $group: { _id: '$registrar', domains: { $sum: 1 } } },
    { $sort: { domains: -1, _id: 1 } },
    { $limit: 3 },
    { $project: { _id: 0, registrar: '$_id', domains: 1 } },
  ];
}

function dailyDateFilter(nicDate: string): object {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(nicDate);
  if (!match) {
    return { nicDate };
  }

  const [, day, month, year] = match;
  return {
    $or: [
      { nicDate },
      { nicDate: { $regex: new RegExp(`^${year}-${month}-${day}(?:$|[ T])`) } },
    ],
  };
}

function monthlyDateFilter(year: number, month: number): object {
  const monthText = String(month).padStart(2, '0');
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dottedDates = Array.from(
    { length: daysInMonth },
    (_, index) => `${String(index + 1).padStart(2, '0')}.${monthText}.${year}`,
  );

  return {
    $or: [
      { nicDate: { $in: dottedDates } },
      { nicDate: { $regex: new RegExp(`^${year}-${monthText}(?:$|[ T-])`) } },
    ],
  };
}

function aggregateResult(result: AnalyticsAggregate | undefined): {
  total: number;
  peakHour?: { hour: number; domains: number };
  busiestDay?: { nicDate: string; domains: number };
  topRegistrars: RegistrarStat[];
} {
  return {
    total: result?.total[0]?.domains ?? 0,
    peakHour: result?.peakHour?.[0],
    busiestDay: result?.busiestDay?.[0],
    topRegistrars: result?.topRegistrars ?? [],
  };
}

function reportPipeline(dateFilter: object, facets: object): object[] {
  return [
    { $match: dateFilter },
    {
      $unionWith: {
        coll: 'oldDomains',
        pipeline: [{ $match: dateFilter }],
      },
    },
    {
      $set: {
        reportDay: {
          $cond: [
            {
              $regexMatch: {
                input: '$nicDate',
                regex: '^\\d{4}-\\d{2}-\\d{2}',
              },
            },
            {
              $concat: [
                { $substrBytes: ['$nicDate', 8, 2] },
                '.',
                { $substrBytes: ['$nicDate', 5, 2] },
                '.',
                { $substrBytes: ['$nicDate', 0, 4] },
              ],
            },
            '$nicDate',
          ],
        },
      },
    },
    { $facet: facets },
  ];
}

export async function publishDailyReport(nicDate: string): Promise<void> {
  const database = await getDb();
  const reports = await database.collection<DomainDoc>('domains').aggregate<AnalyticsAggregate>(
    reportPipeline(dailyDateFilter(nicDate), {
        total: [{ $count: 'domains' }],
        peakHour: [
          {
            $project: {
              capturedAt: {
                $convert: { input: '$date', to: 'date', onError: null, onNull: null },
              },
            },
          },
          { $match: { capturedAt: { $ne: null } } },
          {
            $project: {
              hour: {
                $toInt: {
                  $dateToString: {
                    format: '%H',
                    date: '$capturedAt',
                    timezone: 'Asia/Almaty',
                  },
                },
              },
            },
          },
          { $group: { _id: '$hour', domains: { $sum: 1 } } },
          { $sort: { domains: -1, _id: 1 } },
          { $limit: 1 },
          { $project: { _id: 0, hour: '$_id', domains: 1 } },
        ],
        topRegistrars: registrarPipeline(),
    }),
  ).toArray();
  const report = aggregateResult(reports[0]);
  const message = formatDailyReport({ nicDate, ...report });

  await bot.telegram.sendMessage(env.tgChannelId, message, {
    parse_mode: 'MarkdownV2',
  });
}

export async function publishMonthlyReport({
  year,
  month,
}: Pick<MonthlyReport, 'year' | 'month'>): Promise<void> {
  const database = await getDb();
  const domains = database.collection<DomainDoc>('domains');
  const dateFilter = monthlyDateFilter(year, month);
  const reports = await domains.aggregate<AnalyticsAggregate>(
    reportPipeline(dateFilter, {
        total: [{ $count: 'domains' }],
        busiestDay: [
          { $group: { _id: '$reportDay', domains: { $sum: 1 } } },
          { $sort: { domains: -1, _id: 1 } },
          { $limit: 1 },
          { $project: { _id: 0, nicDate: '$_id', domains: 1 } },
        ],
        topRegistrars: registrarPipeline(),
    }),
  ).toArray();
  const report = aggregateResult(reports[0]);
  const priorYearFilter = monthlyDateFilter(year - 1, month);
  const oldDomains = database.collection<DomainDoc>('oldDomains');
  const [currentPriorYearTotal, oldPriorYearTotal] = await Promise.all([
    domains.countDocuments(priorYearFilter),
    oldDomains.countDocuments(priorYearFilter),
  ]);
  const priorYearTotal = currentPriorYearTotal + oldPriorYearTotal;
  const message = formatMonthlyReport({
    year,
    month,
    priorYearTotal,
    total: report.total,
    busiestDay: report.busiestDay,
    topRegistrars: report.topRegistrars,
  });

  await bot.telegram.sendMessage(env.tgChannelId, message, {
    parse_mode: 'MarkdownV2',
  });
}
