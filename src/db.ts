import { MongoClient, type Db } from 'mongodb';

import { env } from './env.js';
import type { ParserStatus, SettingsDoc } from './types.js';

const connectionUrl = `mongodb://${env.dbUser && env.dbPassword ? `${env.dbUser}:${env.dbPassword}@` : ''}${env.dbHost}/${env.dbName}?retryWrites=true&w=majority&authSource=admin`;

const client = new MongoClient(connectionUrl);

let db: Db | undefined;

const parserStatusKeys = [
  'lastStartedAt',
  'lastFinishedAt',
  'lastSuccessAt',
  'lastError',
  'lastDomainCount',
] as const;

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

function normalizeParserStatus(status: unknown): ParserStatus {
  if (!status || typeof status !== 'object' || Array.isArray(status)) {
    return {};
  }

  const normalized: ParserStatus = {};
  for (const key of parserStatusKeys) {
    const value = (status as Partial<ParserStatus>)[key];
    if (key === 'lastError') {
      if (typeof value === 'string') {
        normalized.lastError = value;
      }
    } else if (typeof value === 'number') {
      normalized[key] = value;
    }
  }
  return normalized;
}

function mergeParserStatus(
  existingStatus: unknown,
  statusUpdate: ParserStatus,
): ParserStatus {
  const merged = normalizeParserStatus(existingStatus);

  for (const key of parserStatusKeys) {
    if (!Object.prototype.hasOwnProperty.call(statusUpdate, key)) {
      continue;
    }

    const value = statusUpdate[key];
    if (value === undefined) {
      delete merged[key];
      continue;
    }

    switch (key) {
      case 'lastStartedAt':
        merged.lastStartedAt = statusUpdate.lastStartedAt;
        break;
      case 'lastFinishedAt':
        merged.lastFinishedAt = statusUpdate.lastFinishedAt;
        break;
      case 'lastSuccessAt':
        merged.lastSuccessAt = statusUpdate.lastSuccessAt;
        break;
      case 'lastError':
        merged.lastError = statusUpdate.lastError;
        break;
      case 'lastDomainCount':
        merged.lastDomainCount = statusUpdate.lastDomainCount;
        break;
    }
  }

  return merged;
}

export async function getStatus(): Promise<ParserStatus> {
  if (!db) {
    return {};
  }

  try {
    const settings = await db.collection<SettingsDoc>('settings').findOne({});
    return normalizeParserStatus(settings?.parserStatus);
  } catch (err) {
    console.error('[MongoDB] get parser status error', err);
    return {};
  }
}

export async function updateParserStatus(statusUpdate: ParserStatus): Promise<void> {
  if (!db) {
    return;
  }

  try {
    const settingsCollection = db.collection<SettingsDoc>('settings');
    const settings = await settingsCollection.findOne({});
    const parserStatus = mergeParserStatus(settings?.parserStatus, statusUpdate);

    if (!settings) {
      await settingsCollection.insertOne({
        proxy: '',
        parserStatus,
      });
      return;
    }

    await settingsCollection.updateOne(
      {},
      { $set: { parserStatus } },
    );
  } catch (err) {
    console.error('[MongoDB] update parser status error', err);
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
