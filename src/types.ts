import type { ObjectId } from 'mongodb';
import type { WhoisField } from 'parse-whois';

export interface SettingsDoc {
  proxy?: string;
}

export interface DomainDoc {
  _id?: ObjectId;
  domain: string;
  nicDate: string;
  date: number;
  whoisData?: WhoisField[];
  whois?: ParsedWhois;
  whoisRaw?: string;
}

export interface ParsedWhois {
  orgName: string;
  registrar: string;
  clientName: string;
  clientPhoneNumber: string;
  clientEmail: string;
  clientAddress: string;
}

export interface ProxyParams {
  host: string;
  port: number;
}
