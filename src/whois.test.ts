import whois from 'whois';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const parseWhoIsData = vi.hoisted(() => vi.fn());

vi.mock('parse-whois', () => ({
  parseWhoIsData,
}));

vi.mock('whois', () => ({
  default: {
    lookup: vi.fn(),
  },
}));

import { whoisAndParse } from './whois.js';

describe('whoisAndParse', () => {
  beforeEach(() => {
    vi.stubEnv('WHOIS_SERVER', 'test.whois');
    vi.stubEnv('WHOIS_PROXY_URL', '');
    vi.stubEnv('WHOIS_PROXY_PORT', '');
    parseWhoIsData.mockReturnValue([
      { attribute: 'Organization Name', value: 'Org' },
      { attribute: 'Name', value: 'Person' },
      { attribute: 'Phone Number', value: '+1' },
      { attribute: 'Email Address', value: 'e@x.com' },
      { attribute: 'Street Address', value: '1 St' },
      { attribute: 'Registrar', value: 'Reg' },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(whois.lookup).mockReset();
    parseWhoIsData.mockReset();
  });

  it('resolves parsed data when returnFull is false', async () => {
    vi.mocked(whois.lookup).mockImplementation((_domain, _opts, cb) => {
      cb(null, 'raw whois text');
    });

    const result = await whoisAndParse('test.kz', false);
    expect(typeof result).toBe('object');
    if (typeof result === 'object' && result !== null && 'parsedData' in result) {
      expect(result.parsedData.orgName).toBe('Org');
      expect(result.parsedData.registrar).toBe('Reg');
    }
    expect(parseWhoIsData).toHaveBeenCalledWith('raw whois text');
  });

  it('resolves raw string when returnFull is true', async () => {
    vi.mocked(whois.lookup).mockImplementation((_domain, _opts, cb) => {
      cb(null, 'full raw');
    });

    const result = await whoisAndParse('test.kz', true);
    expect(result).toBe('full raw');
  });

  it('rejects when whois returns no data', async () => {
    vi.mocked(whois.lookup).mockImplementation((_domain, _opts, cb) => {
      cb(null, '');
    });

    await expect(whoisAndParse('test.kz', false)).rejects.toThrow('Whois is not available');
  });
});
