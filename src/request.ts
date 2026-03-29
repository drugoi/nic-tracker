import axios, { type AxiosInstance } from 'axios';
import tunnel from 'tunnel';

import * as db from './db.js';

let instance: AxiosInstance | undefined;

export async function initAxios(): Promise<AxiosInstance> {
  console.log('🚀 ~ [AXIOS] ready 🟢');
  const dbInstance = await db.getDb();
  const doc = await dbInstance.collection('settings').findOne({});
  const proxyDbUrl = doc && typeof doc.proxy === 'string' ? doc.proxy : undefined;

  const httpsAgent = () => {
    if (proxyDbUrl) {
      const proxyUrl = new URL(proxyDbUrl);
      const port = proxyUrl.port ? Number(proxyUrl.port) : 80;
      return tunnel.httpsOverHttp({
        proxy: {
          host: proxyUrl.hostname,
          port,
        },
      });
    }
    return false;
  };

  instance = axios.create({
    baseURL: 'https://nic.kz/',
    timeout: 15000,
    httpsAgent: httpsAgent(),
    proxy: false,
  });

  instance.interceptors.request.use(
    (config) => {
      const next = { ...config };
      next.httpsAgent = httpsAgent();
      return next;
    },
    (error) => Promise.reject(error),
  );

  return instance;
}

export async function getInstance(): Promise<AxiosInstance> {
  if (!instance) {
    await initAxios();
  }
  if (!instance) {
    throw new Error('Axios instance failed to initialize');
  }
  return instance;
}
