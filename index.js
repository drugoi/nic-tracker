
require('dotenv').config();

const rp = require('request-promise');
const $ = require('cheerio');
const cron = require('node-cron');
const xorBy = require('lodash.xorby');


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
            date: $('td:first-child', domain).text(),
          };

          newDomains.push(newDomain);
        }
      });

      const existingDomains = db.get('domains').value();

      const transaction = db.get('domains')
        .batchUnique('domain', newDomains);

      const differentDomains = xorBy(existingDomains, newDomains, 'domain');

      if (differentDomains.length) {
        transaction.write();
        const message = prepareDomainsMessage(differentDomains);
        bot.telegram.sendMessage(process.env.TG_OWNER_ID, message, {
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

cron.schedule('* * * * *', () => parseNic()).start();

parseNic();
