const prepareDomainsMessage = (domains) => {
  let message = '*Появились новые домены:*\n';

  domains.forEach(({ domain }) => {
    message += `Домен: ${domain}\n`;
  });

  return message;
};


module.exports = {
  prepareDomainsMessage,
};
