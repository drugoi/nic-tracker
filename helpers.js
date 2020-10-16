const prepareDomainsMessage = (domains) => {
  let message = '*Новый домен:*\n\n';

  domains.forEach(({
    domain, orgName, clientName, clientEmail, clientAddress,
  }) => {
    if (orgName) {
      message += `*Домен:* ${domain} — [Whois](https://nic.kz/cgi-bin/whois?query=${domain})
\n*Организация:* ${orgName}\n*Клиент:* ${clientName}\n*Email:* ${clientEmail}\n*Адрес*: ${clientAddress}\n\n`;
    } else {
      message += `*Домен:* ${domain} — [Whois](https://nic.kz/cgi-bin/whois?query=${domain})\n\n`;
    }
  });

  return message;
};

module.exports = {
  prepareDomainsMessage,
};
