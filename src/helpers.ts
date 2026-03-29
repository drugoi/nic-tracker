import type { ParsedWhois } from './types.js';

export type DomainMessageInput = { domain: string } & Partial<ParsedWhois>;

export function escapeMarkdown(text: string | undefined): string {
  if (!text) {
    return '';
  }
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

export function cleanFromPersonalData(text: string): string {
  return text.replace(/\d{12}/g, '[REDACTED]');
}

export function prepareDomainMessage({
  domain,
  orgName,
  registrar,
  clientName,
  clientEmail,
  clientAddress,
}: DomainMessageInput): string {
  const escapedDomain = escapeMarkdown(domain);
  const whoisUrl = `https://nic\\.kz/cgi\\-bin/whois?query=${escapedDomain}`;

  if (orgName && orgName !== '[HIDDEN PERSONAL DATA]') {
    return [
      `*Домен:* ${escapedDomain} \\- [Whois](${whoisUrl})\n`,
      `*Организация:* ${escapeMarkdown(orgName)}`,
      `*Регистратор:* ${escapeMarkdown(registrar || '')}`,
      `*Клиент:* ${escapeMarkdown(cleanFromPersonalData(clientName || ''))}`,
      `*Email:* ${escapeMarkdown(clientEmail || '')}`,
      `*Адрес*: ${escapeMarkdown(clientAddress || '')}`,
      '',
    ].join('\n');
  }

  return `*Домен:* ${escapedDomain} \\- [Whois](${whoisUrl})\n\n`;
}
