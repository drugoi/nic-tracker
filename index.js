/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

require('dotenv').config();

const $ = require('cheerio');
const cron = require('node-cron');

const request = require('./request');
const { db, settingsDb } = require('./db');
const bot = require('./bot');
const whoisAndParse = require('./whois');
const { prepareDomainsMessage } = require('./helpers');

// setup DB defaults
db.defaults({ domains: [] })
  .write();

settingsDb.defaults({
  proxy: '',
}).write();

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
  console.log('parse nic is running');
  request.get('')
    .then(async (res) => {
      const domainsTable = $('#last-ten-table > tbody > tr:nth-child(2) > td > table > tbody', res.data);

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

      const transaction = db.get('domains')
        .batchUnique('domain', newDomains);

      const differentDomains = newDomains
        .filter(({ domain: newDomain }) => !existingDomains.some(({ domain: existDomain }) => existDomain === newDomain));

      if (differentDomains.length) {
        transaction.write();

        const extendedDomains = await parseDomains(differentDomains);
        const message = await prepareDomainsMessage(extendedDomains);
        bot.telegram.sendMessage(process.env.TG_CHANNEL_ID, message, {
          parse_mode: 'markdown',
        });
      }
    })
    .catch((err) => {
      console.error('parseNic -> err', err);

      const message = (err && err.message) || err;
      bot.telegram.sendMessage(process.env.TG_OWNER_ID, message, {
        parse_mode: 'markdown',
      });
    });
};

cron.schedule('*/3 * * * *', () => parseNic()).start();
