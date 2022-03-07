const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('domains.json');
const db = low(adapter);

const settingsAdapter = new FileSync('settings.json');
const settingsDb = low(settingsAdapter);

db._.mixin({
  batchUnique: (array, key, items) => {
    const cleanItems = items
      .filter((newItem) => array.findIndex((el) => el[key] === newItem[key]) === -1);
    return array.push(...cleanItems);
  },
});

module.exports = {
  db,
  settingsDb,
};
