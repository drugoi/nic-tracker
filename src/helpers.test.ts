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
  it('formats full message when org is visible', () => {
    const text = prepareDomainMessage({
      domain: 'example.kz',
      orgName: 'ACME',
      registrar: 'Reg Inc',
      clientName: 'John 123456789012',
      clientEmail: 'a@b.c',
      clientAddress: 'Street 1',
    });
    expect(text).toContain('example\\.kz');
    expect(text).toContain('ACME');
    expect(text).toMatch(/REDACTED/);
  });

  it('formats minimal message for hidden org', () => {
    const text = prepareDomainMessage({
      domain: 'x.kz',
      orgName: '[HIDDEN PERSONAL DATA]',
    });
    expect(text).toContain('x\\.kz');
    expect(text).not.toContain('Организация');
  });

  it('handles missing whois fields', () => {
    const text = prepareDomainMessage({ domain: 'only.kz' });
    expect(text).toContain('only\\.kz');
  });
});
