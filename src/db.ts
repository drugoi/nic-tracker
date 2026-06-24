import { MongoClient, type Db } from 'mongodb';

import { env } from './env.js';
import type { SettingsDoc } from './types.js';

const connectionUrl = `mongodb://${env.dbUser && env.dbPassword ? `${env.dbUser}:${env.dbPassword}@` : ''}${env.dbHost}/${env.dbName}?retryWrites=true&w=majority&authSource=admin`;
const defaultWatchTerms = ['bereke'];

const client = new MongoClient(connectionUrl);

let db: Db | undefined;

function normalizeWatchTerms(watchTerms: unknown): string[] {
  if (!Array.isArray(watchTerms)) {
    return [...defaultWatchTerms];
  }

  const normalized = watchTerms
    .filter((term): term is string => typeof term === 'string')
    .map((term) => term.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : [...defaultWatchTerms];
}

async function getSettingsCollection() {
  const database = await getDb();
  return database.collection<SettingsDoc>('settings');
}

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
        proxy: typeof proxyUrl === 'string' ? proxyUrl : '',
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

export async function getWatchTerms(): Promise<string[]> {
  const settings = await (await getSettingsCollection()).findOne({});
  return normalizeWatchTerms(settings?.watchTerms);
}

async function writeWatchTerms(watchTerms: string[]): Promise<void> {
  await (await getSettingsCollection()).updateOne(
    {},
    { $set: { watchTerms } },
    { upsert: true },
  );
}

export async function addWatchTerm(term: string): Promise<string[]> {
  const trimmedTerm = term.trim();
  const watchTerms = await getWatchTerms();
  const exists = watchTerms.some(
    (watchTerm) => watchTerm.toLowerCase() === trimmedTerm.toLowerCase(),
  );

  if (!trimmedTerm || exists) {
    return watchTerms;
  }

  const updatedTerms = [...watchTerms, trimmedTerm];
  await writeWatchTerms(updatedTerms);
  return updatedTerms;
}

export async function removeWatchTerm(term: string): Promise<string[]> {
  const trimmedTerm = term.trim().toLowerCase();
  const watchTerms = await getWatchTerms();
  const updatedTerms = watchTerms.filter(
    (watchTerm) => watchTerm.toLowerCase() !== trimmedTerm,
  );

  if (updatedTerms.length === watchTerms.length) {
    return watchTerms;
  }

  await writeWatchTerms(updatedTerms);
  return updatedTerms;
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
