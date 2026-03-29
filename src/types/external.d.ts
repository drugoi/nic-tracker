declare module 'parse-whois' {
  export interface WhoisField {
    attribute: string;
    value: string;
  }

  export function parseWhoIsData(data: string): WhoisField[];
}

declare module 'tunnel' {
  import type { Agent } from 'https';

  export function httpsOverHttp(options: {
    proxy: { host: string; port: number };
  }): Agent;
}

declare module 'whois' {
  export interface WhoisLookupOptions {
    server?: string;
    proxy?: {
      host: string;
      port: number;
      type: number;
    } | null;
  }

  export function lookup(
    domain: string,
    options: WhoisLookupOptions,
    callback: (err: Error | null, data: string) => void,
  ): void;
}
