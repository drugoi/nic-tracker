const prepareDomainsMessage = (domains) => {
  let message = '*Появились новые домены:*\n\n';

  domains.forEach(({ domain, date }) => {
    message += `*Домен:* ${domain} — [Whois](https://nic.kz/cgi-bin/whois?query=${domain})\n*Дата появления:* ${new Date(date)}\n\n`;
  });

  return message;
};


module.exports = {
  prepareDomainsMessage,
};
