/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

const cheerio = require('cheerio');

const { ObjectId } = require('mongodb');
const whoisAndParse = require('./whois');
const { bot } = require('./bot-setup');
const { prepareDomainMessage } = require('./helpers');
const request = require('./request');
const db = require('./db');

async function parseDomain(domain, proxyUrl) {
  let domainsData = {};

  try {
    const { whoisData, parsedData } = await whoisAndParse(
      domain.domain,
      false,
      proxyUrl,
    );

    domainsData = {
      ...domain,
      whoisData,
      whois: parsedData,
    };
  } catch (error) {
    domainsData = {
      ...domain,
    };
  }

  return domainsData;
}

const parseNic = async () => {
  console.info('🚀 ~ [PARSER] ready 🟢');

  const requestInstance = await request.getInstance();
  const dbInstance = await db.getDb();
  const { proxy: proxyUrl } = await dbInstance
    .collection('settings')
    .findOne({});

  let proxyParams = {};
  if (proxyUrl) {
    const proxy = new URL(proxyUrl);
    proxyParams = {
      host: proxy.hostname,
      port: proxy.port,
    };
  }

  requestInstance
    .get('')
    .then(async (res) => {
      const $ = cheerio.load(res.data);
      const domainsTable = $(
        '#last-ten-table > tbody > tr:nth-child(2) > td > table > tbody',
      );

      const newDomains = [];

      domainsTable[0].children.forEach((domain) => {
        if ($('a', domain)[0]) {
          const newDomain = {
            domain: $('a', domain).text(),
            nicDate: $('td:first-child', domain).text(),
            date: new Date().getTime(),
          };

          newDomains.push(newDomain);
        }
      });

      // insert new domains to db
      const domainsCollection = await dbInstance.collection('domains');

      try {
        const domainsToSend = [];

        for (const domain of newDomains) {
          const existedDomain = await domainsCollection.findOne({
            domain: domain.domain,
          });

          // if domain exists in db and registration date is not older than 10 days
          // eslint-disable-next-line max-len
          if (
            existedDomain
            && Date.now() - new Date(existedDomain.date).getTime()
              > 1000 * 60 * 60 * 24 * 10
          ) {
            console.log('🚀 ~ domain is older than 10 days', existedDomain);
            const domainsData = await parseDomain(domain, proxyParams);

            await domainsCollection.updateOne(
              { _id: ObjectId(existedDomain._id) },
              { $set: domainsData },
            );

            existedDomain._id = new ObjectId();
            await dbInstance.collection('oldDomains').insertOne(existedDomain);

            domainsToSend.push(domainsData);
          } else if (!existedDomain) {
            const domainsData = await parseDomain(domain, proxyParams);
            await domainsCollection.insertOne(domainsData);

            domainsToSend.push(domainsData);
          }
        }

        domainsToSend.forEach(async (domain) => {
          const message = await prepareDomainMessage({
            ...domain.whois,
            domain: domain.domain,
          });

          bot.telegram.sendMessage(process.env.TG_CHANNEL_ID, message, {
            parse_mode: 'markdown',
          });
        });
      } catch (error) {
        console.error('🚀 ~ [PARSER] ~ insert error', error);
      }
    })
    .catch((err) => {
      const message = (err && err.message) || err;
      console.log('🚀 ~ parseNic ~ err', message);

      bot.telegram.sendMessage(process.env.TG_OWNER_ID, message, {
        parse_mode: 'markdown',
      });
    });
};

module.exports = {
  parseNic,
};
