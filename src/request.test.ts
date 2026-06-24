import { beforeEach, describe, expect, it, vi } from 'vitest';

interface SettingsDoc {
  proxy?: string;
}

interface TunnelOptions {
  proxy: {
    host: string;
    port: number;
  };
}

const dbState = vi.hoisted(() => {
  const state = {
    settingsDoc: null as SettingsDoc | null,
    findOne: vi.fn(),
    collection: vi.fn(),
    getDb: vi.fn(),
  };
  state.findOne.mockImplementation(async () => state.settingsDoc);
  state.collection.mockReturnValue({ findOne: state.findOne });
  state.getDb.mockResolvedValue({ collection: state.collection });
  return state;
});

const tunnelMocks = vi.hoisted(() => ({
  httpsOverHttp: vi.fn((options: TunnelOptions) => ({ tunnelOptions: options })),
}));

vi.mock('./db.js', () => ({
  getDb: dbState.getDb,
}));

vi.mock('tunnel', () => ({
  default: {
    httpsOverHttp: tunnelMocks.httpsOverHttp,
  },
}));

async function loadRequest(): Promise<typeof import('./request.js')> {
  return import('./request.js');
}

describe('request proxy setup', () => {
  beforeEach(() => {
    vi.resetModules();
    dbState.settingsDoc = null;
    dbState.findOne.mockClear();
    dbState.collection.mockClear();
    dbState.getDb.mockClear();
    tunnelMocks.httpsOverHttp.mockClear();
  });

  it('creates an Axios instance with axios proxying disabled when no settings proxy exists', async () => {
    const { initAxios } = await loadRequest();

    const instance = await initAxios();

    expect(instance.defaults.proxy).toBe(false);
    expect(tunnelMocks.httpsOverHttp).not.toHaveBeenCalled();
  });

  it('creates a tunnel agent from the settings proxy host and port', async () => {
    dbState.settingsDoc = { proxy: 'http://proxy.example:3128' };
    const { initAxios } = await loadRequest();

    const instance = await initAxios();

    expect(tunnelMocks.httpsOverHttp).toHaveBeenCalledWith({
      proxy: {
        host: 'proxy.example',
        port: 3128,
      },
    });
    expect(instance.defaults.httpsAgent).toEqual({
      tunnelOptions: {
        proxy: {
          host: 'proxy.example',
          port: 3128,
        },
      },
    });
    expect(instance.defaults.proxy).toBe(false);
  });

  it('keeps the existing client on the first proxy until Axios is explicitly reinitialized', async () => {
    dbState.settingsDoc = { proxy: 'http://first.example:8080' };
    const { getInstance, initAxios } = await loadRequest();
    const firstInstance = await initAxios();
    const firstAgent = firstInstance.defaults.httpsAgent;

    dbState.settingsDoc = { proxy: 'http://second.example:9090' };
    const cachedInstance = await getInstance();

    expect(cachedInstance).toBe(firstInstance);
    expect(cachedInstance.defaults.httpsAgent).toBe(firstAgent);
    expect(tunnelMocks.httpsOverHttp).toHaveBeenCalledTimes(1);

    const reinitializedInstance = await initAxios();

    expect(reinitializedInstance).not.toBe(firstInstance);
    expect(tunnelMocks.httpsOverHttp).toHaveBeenLastCalledWith({
      proxy: {
        host: 'second.example',
        port: 9090,
      },
    });
  });
});
