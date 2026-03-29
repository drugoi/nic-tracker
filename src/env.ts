function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v === '' ? undefined : v;
}

export const env = {
  get botToken(): string {
    return required('BOT_TOKEN');
  },
  get tgChannelId(): string {
    return required('TG_CHANNEL_ID');
  },
  get tgOwnerId(): string {
    return required('TG_OWNER_ID');
  },
  get dbHost(): string {
    return required('DB_HOST');
  },
  get dbName(): string {
    return required('DB_NAME');
  },
  get dbUser(): string | undefined {
    return optional('DB_USER');
  },
  get dbPassword(): string | undefined {
    return optional('DB_PASSWORD');
  },
  get whoisServer(): string | undefined {
    return optional('WHOIS_SERVER');
  },
  get whoisProxyUrl(): string | undefined {
    return optional('WHOIS_PROXY_URL');
  },
  get whoisProxyPort(): string | undefined {
    return optional('WHOIS_PROXY_PORT');
  },
};
