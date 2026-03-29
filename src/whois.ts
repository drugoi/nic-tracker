import { parseWhoIsData } from 'parse-whois';
import type { WhoisField } from 'parse-whois';
import whois from 'whois';

import { env } from './env.js';
import type { ParsedWhois } from './types.js';

type WhoisFieldRow = WhoisField;

function findFieldByAttr(data: WhoisFieldRow[], field: string): WhoisFieldRow {
  return data.find((item) => item.attribute.startsWith(field)) ?? { attribute: '', value: '' };
}

function findFieldsByAttrs(data: WhoisFieldRow[], fields: string[]): WhoisFieldRow[] {
  return fields.map((field) => findFieldByAttr(data, field));
}

function findRegistrar(data: WhoisFieldRow[]): WhoisFieldRow {
  return (
    data.find((item) => item.attribute.toLowerCase().includes('registrar')) ?? {
      attribute: '',
      value: '',
    }
  );
}

export function whoisAndParse(
  domainToParse: string,
  returnFull = false,
): Promise<string | { whoisData: WhoisFieldRow[]; parsedData: ParsedWhois }> {
  return new Promise((resolve, reject) => {
    const whoisProxyUrl = env.whoisProxyUrl;
    const whoisProxyPort = env.whoisProxyPort;

    whois.lookup(
      domainToParse,
      {
        server: env.whoisServer,
        proxy:
          whoisProxyUrl && whoisProxyPort
            ? {
                host: whoisProxyUrl,
                port: Number.parseInt(whoisProxyPort, 10),
                type: 5,
              }
            : null,
      },
      (err, data) => {
        if (err) {
          console.error('🚀 ~ whois.lookup ~ err:', err);
        }
        if (!data) {
          reject(new Error('Whois is not available'));
          return;
        }
        const whoisData = parseWhoIsData(data);

        if (returnFull) {
          resolve(data);
          return;
        }

        const emptyField: WhoisFieldRow = { attribute: '', value: '' };
        const [
          orgName = emptyField,
          clientName = emptyField,
          clientPhoneNumber = emptyField,
          clientEmail = emptyField,
          clientAddress = emptyField,
        ] = findFieldsByAttrs(whoisData, [
          'Organization Name',
          'Name',
          'Phone Number',
          'Email Address',
          'Street Address',
        ]);

        const registrar = findRegistrar(whoisData);

        const parsedData: ParsedWhois = {
          orgName: orgName.value || 'Не указано',
          registrar: registrar.value || 'Не указан',
          clientName: clientName.value || 'Не указано',
          clientPhoneNumber: clientPhoneNumber.value || 'Не указан',
          clientEmail: clientEmail.value || 'Не указан',
          clientAddress: clientAddress.value || 'Не указан',
        };

        resolve({
          whoisData,
          parsedData,
        });
      },
    );
  });
}
