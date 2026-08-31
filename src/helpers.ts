import type { ParsedWhois } from './types.js';

export type DomainMessageInput = {
  domain: string;
  nicDate?: string;
} & Partial<ParsedWhois>;

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
  nicDate,
}: DomainMessageInput): string {
  const escapedDomain = escapeMarkdown(domain);
  const whoisUrl = `https://nic\\.kz/cgi\\-bin/whois?query=${escapedDomain}`;
  const lines = [`🆕 *${escapedDomain}*`];

  if (nicDate) {
    lines.push(`📅 ${escapeMarkdown(nicDate)}`);
  }

  if (orgName === '[HIDDEN PERSONAL DATA]') {
    lines.push('🔒 Данные владельца скрыты');
  } else if (orgName) {
    lines.push(`🏢 Организация: ${escapeMarkdown(orgName)}`);
  }

  if (registrar) {
    lines.push(`🏷 Регистратор: ${escapeMarkdown(registrar)}`);
  }

  lines.push('', `[Whois](${whoisUrl})`);
  return lines.join('\n');
}
