// Example of personal data: 000924050665 (12 symbols of IIN)

const cleanFromPersonalData = (text) => text.replace(/\d{12}/g, '[REDACTED]');

const prepareDomainMessage = ({
  domain, orgName, clientName, clientEmail, clientAddress,
}) => {
  let message = '';

  if (orgName) {
    message += `*Домен:* ${domain} — [Whois](https://nic.kz/cgi-bin/whois?query=${domain})
\n*Организация:* ${orgName}\n*Клиент:* ${cleanFromPersonalData(clientName)}\n*Email:* ${clientEmail}\n*Адрес*: ${clientAddress}\n\n`;
  } else {
    message += `*Домен:* ${domain} — [Whois](https://nic.kz/cgi-bin/whois?query=${domain})\n\n`;
  }

  return message;
};

module.exports = {
  prepareDomainMessage,
};
