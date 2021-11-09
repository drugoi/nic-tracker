const axios = require('axios');
const tunnel = require('tunnel');

const { settingsDb } = require('./db');

const httpsAgent = () => {
  const proxyDbUrl = settingsDb.get('proxy').value();

  if (proxyDbUrl) {
    const proxyUrl = new URL(proxyDbUrl);
    return tunnel.httpsOverHttp({
      proxy: {
        host: proxyUrl.hostname,
        port: proxyUrl.port,
      },
    });
  }
  return false;
};

const instance = axios.create({
  baseURL: 'https://nic.kz/',
  timeout: 3000,
  httpsAgent: httpsAgent(),
  proxy: false,
});

instance.interceptors.request.use(
  (config) => {
    // eslint-disable-next-line no-param-reassign
    config.httpsAgent = httpsAgent();

    return config;
  },
  (error) => Promise.reject(error),
);

module.exports = instance;
