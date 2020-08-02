const axios = require('axios');
const tunnel = require('tunnel');


const { settingsDb } = require('./db');

const httpsAgent = () => {
  const proxyDbUrl = settingsDb.get('proxy').value();

  if (proxyDbUrl) {
    const proxyUrl = new URL(settingsDb.get('proxy'));
    return tunnel.httpsOverHttp({
      proxy: {
        host: proxyUrl.host,
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
