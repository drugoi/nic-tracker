import { describe, expect, it } from 'vitest';

import {
  cleanFromPersonalData,
  escapeMarkdown,
  prepareDomainMessage,
} from './helpers.js';

describe('escapeMarkdown', () => {
  it('returns empty string for undefined', () => {
    expect(escapeMarkdown(undefined)).toBe('');
  });

  it('escapes MarkdownV2 special characters', () => {
    expect(escapeMarkdown('a_b*c')).toBe('a\\_b\\*c');
  });
});

describe('cleanFromPersonalData', () => {
  it('redacts 12-digit sequences', () => {
    expect(cleanFromPersonalData('id 123456789012 end')).toBe('id [REDACTED] end');
  });
});

describe('prepareDomainMessage', () => {
  it('formats a concise MarkdownV2 message without emoji', () => {
    const text = prepareDomainMessage({
      domain: 'example.kz',
      nicDate: '31.08.2026',
      orgName: 'ACME',
      registrar: 'Reg Inc',
      clientName: 'John 123456789012',
      clientEmail: 'a@b.c',
      clientAddress: 'Street 1',
    });

    expect(text).toBe(
      '*example\\.kz*\n'
      + '*Дата регистрации:* 31\\.08\\.2026\n'
      + '*Организация:* ACME\n'
      + '*Регистратор:* Reg Inc\n\n'
      + '[Whois](https://nic\\.kz/cgi\\-bin/whois?query=example\\.kz)',
    );
    expect(text).not.toContain('John');
    expect(text).not.toContain('a@b.c');
    expect(text).not.toContain('Street');
  });

  it('marks owner data as hidden and keeps Whois on a separate line', () => {
    const text = prepareDomainMessage({
      domain: 'x.kz',
      orgName: '[HIDDEN PERSONAL DATA]',
      registrar: 'Reg Inc',
      nicDate: '31.08.2026',
    });

    expect(text).toBe(
      '*x\\.kz*\n'
      + '*Дата регистрации:* 31\\.08\\.2026\n'
      + '*Данные владельца:* скрыты\n'
      + '*Регистратор:* Reg Inc\n\n'
      + '[Whois](https://nic\\.kz/cgi\\-bin/whois?query=x\\.kz)',
    );
  });

  it('omits unavailable optional fields', () => {
    const text = prepareDomainMessage({ domain: 'only.kz' });

    expect(text).toBe(
      '*only\\.kz*\n\n'
      + '[Whois](https://nic\\.kz/cgi\\-bin/whois?query=only\\.kz)',
    );
  });
});
