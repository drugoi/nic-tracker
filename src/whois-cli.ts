import { whoisAndParse } from './whois.js';

const domain = process.argv[2];

if (domain) {
  whoisAndParse(domain)
    .then((res) => {
      console.log('🚀 ~ whoisAndParse ~ res', res);
    })
    .catch((err) => {
      console.error('🚀 ~ whoisAndParse ~ err', err);
    });
}
