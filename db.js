const { MongoClient } = require('mongodb');

const {
  DB_NAME,
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
} = process.env;

const connectionUrl = `mongodb://${DB_USER ? `${DB_USER}:${DB_PASSWORD}@` : ''}${DB_HOST}/${DB_NAME}?retryWrites=true&w=majority&authSource=admin`;
console.log('🚀 ~ connectionUrl', connectionUrl);

const client = new MongoClient(connectionUrl);

let db;

const connect = async () => {
  try {
    await client.connect();
    console.log('🚀 ~ [MongoDB] ready 🟢');

    db = client.db(DB_NAME);
  } catch (err) {
    console.error('💥 ~ [MongoDB] connection error', err);
  }
};

const updateSettings = async (proxyUrl) => {
  try {
    const settings = await db.collection('settings').findOne({});

    if (!settings) {
      console.log('🚀 ~ [SETTINGS] creating 🟡');
      await db.collection('settings').insertOne({
        proxy: '',
      });
      console.log('🚀 ~ [SETTINGS] created 🟢');
    } else if (typeof proxyUrl === 'string') {
      console.log('🚀 ~ [SETTINGS] updating');
      await db.collection('settings').updateOne(
        {},
        { $set: { proxy: proxyUrl } },
      );
    } else {
      console.log('🚀 ~ [SETTINGS] ready 🟢');
    }
  } catch (err) {
    console.error('💥 ~ [MongoDB] setup settings error', err);
  }
};

const setupDomainIndexes = async () => {
  try {
    const indexes = await db.collection('domains').indexes();
    if (!indexes.some((index) => index.name
      === 'domain_1')) {
      console.log('🚀 ~ [INDEXES] creating 🟡');
      await db.collection('domains').createIndexes([
        { key: { domain: 1 }, unique: true },
      ]);
      console.log('🚀 ~ [INDEXES] created 🟢');
    } else {
      console.log('🚀 ~ [INDEXES] ready 🟢');
    }
  } catch (err) {
    console.error('💥 ~ [MongoDB] setup indexes error', err);
  }
};

const setupDb = async () => {
  await connect();
  await setupDomainIndexes();
  await updateSettings();

  return db;
};

module.exports = {
  db,
  setupDb,
  updateSettings,
};
