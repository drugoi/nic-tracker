import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbState = vi.hoisted(() => {
  const state = {
    domainsCollection: {
      createIndexes: vi.fn(),
      indexes: vi.fn(),
    },
    settingsCollection: {
      findOne: vi.fn(),
      insertOne: vi.fn(),
      updateOne: vi.fn(),
    },
    collection: vi.fn(),
    client: {
      connect: vi.fn(),
      db: vi.fn(),
    },
    MongoClient: vi.fn(),
  };

  state.collection.mockImplementation((name: string) => {
    if (name === 'domains') {
      return state.domainsCollection;
    }
    if (name === 'settings') {
      return state.settingsCollection;
    }
    throw new Error(`Unexpected collection ${name}`);
  });
  state.client.db.mockReturnValue({ collection: state.collection });
  state.MongoClient.mockReturnValue(state.client);

  return state;
});

vi.mock('mongodb', () => ({
  MongoClient: dbState.MongoClient,
}));

vi.mock('./env.js', () => ({
  env: {
    dbHost: 'localhost:27017',
    dbName: 'test-db',
    dbPassword: '',
    dbUser: '',
  },
}));

async function loadInitializedDb(): Promise<typeof import('./db.js')> {
  const dbModule = await import('./db.js');

  dbState.domainsCollection.indexes.mockResolvedValue([{ name: 'domain_1' }]);
  dbState.settingsCollection.findOne.mockResolvedValue({ proxy: '' });
  await dbModule.setupDb();

  dbState.settingsCollection.findOne.mockReset();
  dbState.settingsCollection.insertOne.mockReset();
  dbState.settingsCollection.updateOne.mockReset();

  return dbModule;
}

describe('updateSettings', () => {
  beforeEach(() => {
    vi.resetModules();
    dbState.domainsCollection.createIndexes.mockReset();
    dbState.domainsCollection.indexes.mockReset();
    dbState.settingsCollection.findOne.mockReset();
    dbState.settingsCollection.insertOne.mockReset();
    dbState.settingsCollection.updateOne.mockReset();
    dbState.collection.mockClear();
    dbState.client.connect.mockReset();
    dbState.client.db.mockClear();
    dbState.MongoClient.mockClear();
    dbState.MongoClient.mockReturnValue(dbState.client);
  });

  it('inserts the requested proxy when settings are missing', async () => {
    const { updateSettings } = await loadInitializedDb();
    dbState.settingsCollection.findOne.mockResolvedValue(null);

    await updateSettings('http://proxy.example:3128');

    expect(dbState.settingsCollection.insertOne).toHaveBeenCalledWith({
      proxy: 'http://proxy.example:3128',
    });
    expect(dbState.settingsCollection.updateOne).not.toHaveBeenCalled();
  });

  it('inserts an empty proxy when settings are missing and no proxy is provided', async () => {
    const { updateSettings } = await loadInitializedDb();
    dbState.settingsCollection.findOne.mockResolvedValue(null);

    await updateSettings();

    expect(dbState.settingsCollection.insertOne).toHaveBeenCalledWith({
      proxy: '',
    });
    expect(dbState.settingsCollection.updateOne).not.toHaveBeenCalled();
  });

  it('updates an existing settings document with an empty proxy', async () => {
    const { updateSettings } = await loadInitializedDb();
    dbState.settingsCollection.findOne.mockResolvedValue({
      proxy: 'http://proxy.example:3128',
    });

    await updateSettings('');

    expect(dbState.settingsCollection.updateOne).toHaveBeenCalledWith(
      {},
      { $set: { proxy: '' } },
    );
    expect(dbState.settingsCollection.insertOne).not.toHaveBeenCalled();
  });
});

describe('watch terms settings', () => {
  beforeEach(() => {
    vi.resetModules();
    dbState.domainsCollection.createIndexes.mockReset();
    dbState.domainsCollection.indexes.mockReset();
    dbState.settingsCollection.findOne.mockReset();
    dbState.settingsCollection.insertOne.mockReset();
    dbState.settingsCollection.updateOne.mockReset();
    dbState.collection.mockClear();
    dbState.client.connect.mockReset();
    dbState.client.db.mockClear();
    dbState.MongoClient.mockClear();
    dbState.MongoClient.mockReturnValue(dbState.client);
  });

  it('defaults missing watch terms to bereke when reading', async () => {
    const { getWatchTerms } = await loadInitializedDb();
    dbState.settingsCollection.findOne.mockResolvedValue({
      proxy: 'http://proxy.example:3128',
    });

    await expect(getWatchTerms()).resolves.toEqual(['bereke']);
  });

  it('defaults empty watch terms to bereke when reading', async () => {
    const { getWatchTerms } = await loadInitializedDb();
    dbState.settingsCollection.findOne.mockResolvedValue({
      proxy: 'http://proxy.example:3128',
      watchTerms: [],
    });

    await expect(getWatchTerms()).resolves.toEqual(['bereke']);
  });

  it('reads configured watch terms', async () => {
    const { getWatchTerms } = await loadInitializedDb();
    dbState.settingsCollection.findOne.mockResolvedValue({
      proxy: 'http://proxy.example:3128',
      watchTerms: ['acme', 'Bereke'],
    });

    await expect(getWatchTerms()).resolves.toEqual(['acme', 'Bereke']);
  });

  it('adds a watch term without overwriting existing settings fields', async () => {
    const { addWatchTerm } = await loadInitializedDb();
    dbState.settingsCollection.findOne.mockResolvedValue({
      proxy: 'http://proxy.example:3128',
      parserStatus: { lastRunAt: 123 },
      watchTerms: ['bereke'],
    });

    await expect(addWatchTerm('acme')).resolves.toEqual(['bereke', 'acme']);

    expect(dbState.settingsCollection.updateOne).toHaveBeenCalledWith(
      {},
      { $set: { watchTerms: ['bereke', 'acme'] } },
      { upsert: true },
    );
  });

  it('does not duplicate a watch term case-insensitively', async () => {
    const { addWatchTerm } = await loadInitializedDb();
    dbState.settingsCollection.findOne.mockResolvedValue({
      proxy: 'http://proxy.example:3128',
      watchTerms: ['Bereke'],
    });

    await expect(addWatchTerm('bereke')).resolves.toEqual(['Bereke']);

    expect(dbState.settingsCollection.updateOne).not.toHaveBeenCalled();
  });

  it('removes a watch term without overwriting existing settings fields', async () => {
    const { removeWatchTerm } = await loadInitializedDb();
    dbState.settingsCollection.findOne.mockResolvedValue({
      proxy: 'http://proxy.example:3128',
      parserStatus: { lastRunAt: 123 },
      watchTerms: ['bereke', 'acme'],
    });

    await expect(removeWatchTerm('BEREKE')).resolves.toEqual(['acme']);

    expect(dbState.settingsCollection.updateOne).toHaveBeenCalledWith(
      {},
      { $set: { watchTerms: ['acme'] } },
      { upsert: true },
    );
  });
});
