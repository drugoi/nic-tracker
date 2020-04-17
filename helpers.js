const prepareDomainsMessage = (domains) => {
  let message = '*Появились новые домены:*\n\n';

  domains.forEach(({ domain, orgName, clientName }) => {
    if (orgName) {
      message += `*Домен:* ${domain} — [Whois](https://nic.kz/cgi-bin/whois?query=${domain})
\n*Организация:* ${orgName}\n*Клиент:* ${clientName}\n\n`;
    } else {
      message += `*Домен:* ${domain} — [Whois](https://nic.kz/cgi-bin/whois?query=${domain})\n\n`;
    }
  });

  return message;
};

module.exports = {
  prepareDomainsMessage,
};
