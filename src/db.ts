import { MongoClient, type Db } from 'mongodb';

import { env } from './env.js';

const connectionUrl = `mongodb://${env.dbUser && env.dbPassword ? `${env.dbUser}:${env.dbPassword}@` : ''}${env.dbHost}/${env.dbName}?retryWrites=true&w=majority&authSource=admin`;

const client = new MongoClient(connectionUrl);

let db: Db | undefined;

async function connect(): Promise<void> {
  try {
    await client.connect();
    db = client.db(env.dbName);
  } catch (err) {
    console.error('[MongoDB] connection error', err);
  }
}

export async function updateSettings(proxyUrl?: string): Promise<void> {
  if (!db) {
    return;
  }
  try {
    const settings = await db.collection('settings').findOne({});

    if (!settings) {
      console.log('[SETTINGS] creating default document');
      await db.collection('settings').insertOne({
        proxy: '',
      });
      console.log('[SETTINGS] created');
    } else if (typeof proxyUrl === 'string') {
      console.log('[SETTINGS] updating proxy');
      await db.collection('settings').updateOne(
        {},
        { $set: { proxy: proxyUrl } },
      );
    }
  } catch (err) {
    console.error('[MongoDB] setup settings error', err);
  }
}

async function setupDomainIndexes(): Promise<void> {
  if (!db) {
    return;
  }
  try {
    const indexes = await db.collection('domains').indexes();
    if (!indexes.some((index) => index.name === 'domain_1')) {
      console.log('[INDEXES] creating domain_1');
      await db.collection('domains').createIndexes([
        { key: { domain: 1 }, unique: true },
      ]);
      console.log('[INDEXES] created');
    }
  } catch (err) {
    console.error('[MongoDB] setup indexes error', err);
  }
}

export async function setupDb(): Promise<Db> {
  await connect();
  await setupDomainIndexes();
  await updateSettings();
  if (!db) {
    throw new Error('MongoDB failed to initialize');
  }
  return db;
}

export async function getDb(): Promise<Db> {
  if (!db) {
    await setupDb();
  }
  if (!db) {
    throw new Error('MongoDB failed to initialize');
  }
  return db;
}
