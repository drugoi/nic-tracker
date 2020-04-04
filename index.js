
require('dotenv').config();

const rp = require('request-promise');
const $ = require('cheerio');
const cron = require('node-cron');


const db = require('./db');
const bot = require('./bot');
const { prepareDomainsMessage } = require('./helpers');

const url = 'https://nic.kz/index.jsp';

db.defaults({ domains: [] })
  .write();


const parseNic = () => {
  console.log('parse nic is running');
  rp(url)
    .then((html) => {
      const domainsTable = $('#last-ten-table > tbody > tr:nth-child(2) > td > table > tbody', html);

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
        const message = prepareDomainsMessage(differentDomains);
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

cron.schedule('*/2 * * * *', () => parseNic()).start();
