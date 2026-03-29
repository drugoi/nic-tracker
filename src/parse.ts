import type { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { ObjectId } from 'mongodb';

import { bot } from './bot-setup.js';
import * as db from './db.js';
import { prepareDomainMessage } from './helpers.js';
import * as request from './request.js';
import type { DomainDoc } from './types.js';
import { whoisAndParse } from './whois.js';
import { env } from './env.js';

async function parseDomain(
  domain: Pick<DomainDoc, 'domain' | 'nicDate' | 'date'>,
): Promise<DomainDoc> {
  let domainsData: DomainDoc = { ...domain };

  try {
    const result = await whoisAndParse(domain.domain, false);
    if (typeof result === 'string') {
      return domainsData;
    }
    const { whoisData, parsedData } = result;
    domainsData = {
      ...domain,
      whoisData,
      whois: parsedData,
    };
  } catch {
    domainsData = {
      ...domain,
    };
  }

  return domainsData;
}

export async function parseNic(axiosInstance?: AxiosInstance): Promise<void> {
  console.info('🚀 ~ [PARSER] ready 🟢');

  const requestInstance = axiosInstance ?? (await request.getInstance());
  const dbInstance = await db.getDb();

  requestInstance
    .get('')
    .then(async (res) => {
      const $ = cheerio.load(res.data as string);
      const domainsTable = $(
        '#last-ten-table > tbody > tr:nth-child(2) > td > table > tbody',
      );

      const newDomains: Pick<DomainDoc, 'domain' | 'nicDate' | 'date'>[] = [];

      const tbody = domainsTable.get(0);
      if (!tbody || !tbody.children) {
        return;
      }

      for (const domain of tbody.children) {
        const row = $(domain);
        const link = $('a', domain).first();
        if (link.length > 0) {
          const newDomain: Pick<DomainDoc, 'domain' | 'nicDate' | 'date'> = {
            domain: link.text(),
            nicDate: row.find('td:first-child').text(),
            date: Date.now(),
          };
          newDomains.push(newDomain);
        }
      }

      const domainsCollection = dbInstance.collection<DomainDoc>('domains');

      try {
        const domainsToSend: DomainDoc[] = [];

        for (const domain of newDomains) {
          const existedDomain = await domainsCollection.findOne({
            domain: domain.domain,
          });

          if (
            existedDomain
            && Date.now() - new Date(existedDomain.date).getTime()
              > 1000 * 60 * 60 * 24 * 10
          ) {
            console.log('🚀 ~ domain is older than 10 days', existedDomain);
            const domainsData = await parseDomain(domain);

            if (domain.domain.includes('bereke')) {
              bot.telegram.sendMessage(
                env.tgOwnerId,
                `Новый домен: ${domain.domain}`,
                {
                  parse_mode: 'Markdown',
                },
              );
            }

            await domainsCollection.updateOne(
              { _id: new ObjectId(existedDomain._id) },
              { $set: domainsData },
            );

            const copyForOld = { ...existedDomain, _id: new ObjectId() };
            await dbInstance.collection('oldDomains').insertOne(copyForOld);

            domainsToSend.push(domainsData);
          } else if (!existedDomain) {
            const domainsData = await parseDomain(domain);
            await domainsCollection.insertOne(domainsData);
            domainsToSend.push(domainsData);
          }
        }

        for (const domain of domainsToSend) {
          const message = await prepareDomainMessage({
            domain: domain.domain,
            ...domain.whois,
          });

          bot.telegram.sendMessage(env.tgChannelId, message, {
            parse_mode: 'MarkdownV2',
          });
        }
      } catch (error) {
        console.error('🚀 ~ [PARSER] ~ insert error', error);
      }
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.log('🚀 ~ parseNic ~ err', message);

      bot.telegram.sendMessage(env.tgOwnerId, message, {
        parse_mode: 'Markdown',
      });
    });
}
