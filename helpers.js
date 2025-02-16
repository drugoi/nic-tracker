// Example of personal data: 000924050665 (12 symbols of IIN)

const escapeMarkdown = (text) => {
  if (!text) return '';
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
};

const cleanFromPersonalData = (text) => text.replace(/\d{12}/g, '[REDACTED]');

const prepareDomainMessage = ({
  domain,
  orgName,
  clientName,
  clientEmail,
  clientAddress,
}) => {
  const escapedDomain = escapeMarkdown(domain);
  const whoisUrl = `https://nic\\.kz/cgi\\-bin/whois?query=${escapedDomain}`;

  if (orgName) {
    return [
      `*Домен:* ${escapedDomain} \\- [Whois](${whoisUrl})`,
      `*Организация:* ${escapeMarkdown(orgName)}`,
      `*Клиент:* ${escapeMarkdown(cleanFromPersonalData(clientName || ''))}`,
      `*Email:* ${escapeMarkdown(clientEmail || '')}`,
      `*Адрес*: ${escapeMarkdown(clientAddress || '')}`,
      '',
    ].join('\n');
  }

  return `*Домен:* ${escapedDomain} \\- [Whois](${whoisUrl})\n\n`;
};

module.exports = {
  prepareDomainMessage,
  cleanFromPersonalData,
};
