const whois = require('whois');
const parser = require('parse-whois');

const domain = process.argv.slice(2)[0];

const whoisAndParse = (domainToParse) => new Promise((resolve, reject) => {
  whois.lookup(domainToParse, (err, data) => {
    if (!data) {
      return reject(new Error('Whois is not available'));
    }
    const whoisData = parser.parseWhoIsData(data);

    // TODO: cleanup this mess
    const orgName = whoisData.find((item) => item.attribute.startsWith('Organization Name'));
    const clientName = whoisData.find((item) => item.attribute.startsWith('Name'));
    const clientPhoneNumber = whoisData.find((item) => item.attribute.startsWith('Phone Number'));
    const clientEmail = whoisData.find((item) => item.attribute.startsWith('Email Address'));
    const clientAddress = whoisData.find((item) => item.attribute.startsWith('Street Address'));


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
