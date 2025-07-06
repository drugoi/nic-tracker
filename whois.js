const whois = require('whois');
const parser = require('parse-whois');

// For CLI
const domain = process.argv.slice(2)[0];

const findFieldByAttr = (data, field) => data.find((item) => item.attribute.startsWith(field)) || {
  value: '',
};

const findFieldsByAttrs = (data, fields) => fields.map((field) => findFieldByAttr(data, field));

const findRegistrar = (data) =>
  data.find((item) => item.attribute.toLowerCase().includes('registrar')) || {
    value: '',
  };

const whoisAndParse = (
  domainToParse,
  returnFull = false,
) => new Promise((resolve, reject) => {
  whois.lookup(
    domainToParse,
    {
      server: process.env.WHOIS_SERVER,
      proxy: process.env.WHOIS_PROXY_URL ? {
        host: process.env.WHOIS_PROXY_URL,
        port: parseInt(process.env.WHOIS_PROXY_PORT, 10),
        type: 5,
      } : null,
    },
    (err, data) => {
      if (err) {
        console.error('🚀 ~ whois.lookup ~ err:', err);
      }
      if (!data) {
        return reject(new Error('Whois is not available'));
      }
      const whoisData = parser.parseWhoIsData(data);

      if (returnFull) {
        return resolve(data);
      }

      const [orgName, clientName, clientPhoneNumber, clientEmail, clientAddress] =
        findFieldsByAttrs(whoisData, [
          'Organization Name',
          'Name',
          'Phone Number',
          'Email Address',
          'Street Address',
        ]);

      const registrar = findRegistrar(whoisData);

      const parsedData = {
        orgName: orgName.value || 'Не указано',
        registrar: registrar.value || 'Не указан',
        clientName: clientName.value || 'Не указано',
        clientPhoneNumber: clientPhoneNumber.value || 'Не указан',
        clientEmail: clientEmail.value || 'Не указан',
        clientAddress: clientAddress.value || 'Не указан',
      };

      return resolve({
        whoisData,
        parsedData,
      });
    },
  );
});

if (domain) {
  whoisAndParse(domain)
    .then((res) => {
      console.log('🚀 ~ whoisAndParse ~ res', res);
    })
    .catch((err) => {
      console.error('🚀 ~ whoisAndParse ~ err', err);
    });
}

module.exports = whoisAndParse;
