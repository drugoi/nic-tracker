/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

const cheerio = require('cheerio');

const { db } = require('./db');
const request = require('./request');
const whoisAndParse = require('./whois');
const { bot } = require('./bot-setup');
const { prepareDomainsMessage } = require('./helpers');

async function parseDomains(domains) {
  const domainsData = [];

  for (const item of domains) {
    try {
      const domainWhois = await whoisAndParse(item.domain);

      domainsData.push({
        ...item,
        ...domainWhois,
      });
    } catch (error) {
      domainsData.push({
        ...item,
      });
    }
  }

  return domainsData;
}

const parseNic = () => {
  console.info('🚀 ~ parseNic ~ started');

  request
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

      const existingDomains = db.get('domains').value();

      const transaction = db.get('domains').batchUnique('domain', newDomains);

      const differentDomains = newDomains.filter(
        ({ domain: newDomain }) => !existingDomains.some(
          ({ domain: existDomain }) => existDomain === newDomain,
        ),
      );

      if (differentDomains.length) {
        transaction.write();

        const extendedDomains = await parseDomains(differentDomains);

        extendedDomains.forEach(async (domain) => {
          const message = await prepareDomainsMessage([domain]);

          bot.telegram.sendMessage(process.env.TG_CHANNEL_ID, message, {
            parse_mode: 'markdown',
          });
        });
      }
    })
    .catch((err) => {
      console.error('parseNic -> err', err.message);

      const message = (err && err.message) || err;

      bot.telegram.sendMessage(process.env.TG_OWNER_ID, message, {
        parse_mode: 'markdown',
      });
    });
};

module.exports = {
  parseNic,
};
