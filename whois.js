const whois = require('whois');
const parser = require('parse-whois');

// For CLI
const domain = process.argv.slice(2)[0];

const findFieldByAttr = (data, field) => data.find((item) => item.attribute.startsWith(field));

const whoisAndParse = (domainToParse, returnFull = false) => new Promise((resolve, reject) => {
  whois.lookup(domainToParse, (err, data) => {
    if (!data) {
      return reject(new Error('Whois is not available'));
    }
    const whoisData = parser.parseWhoIsData(data);

    if (returnFull) {
      return resolve(data);
    }

    // TODO: cleanup this mess
    const orgName = findFieldByAttr(whoisData, 'Organization Name');
    const clientName = findFieldByAttr(whoisData, 'Name');
    const clientPhoneNumber = findFieldByAttr(whoisData, 'Phone Number');
    const clientEmail = findFieldByAttr(whoisData, 'Email Address');
    const clientAddress = findFieldByAttr(whoisData, 'Street Address');

    if (!orgName) {
      return reject(new Error('Whois is not available'));
    }

    const parsedData = {
      orgName: orgName.value,
      clientName: clientName.value,
      clientPhoneNumber: clientPhoneNumber.value,
      clientEmail: clientEmail.value,
      clientAddress: clientAddress.value,
    };

    return resolve(parsedData);
  });
});

if (domain) {
  whoisAndParse(domain).then((res) => {
    console.log('whoisAndParse', res);
  });
}

module.exports = whoisAndParse;
