require('dotenv').config();

const cron = require('node-cron');

const { db, settingsDb } = require('./db');
const { parseNic } = require('./parse');

// setup DB defaults
db.defaults({ domains: [] })
  .write();

settingsDb.defaults({
  proxy: '',
}).write();

parseNic();

cron.schedule('*/5 * * * *', () => parseNic()).start();
