const axios = require('axios');
const tunnel = require('tunnel');

const db = require('./db');

let instance;

const initAxios = async () => {
  console.log('🚀 ~ [AXIOS] ready 🟢');
  const { proxy: proxyDbUrl } = await db.getDb().collection('settings').findOne({});

  const httpsAgent = () => {
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

  instance = await axios.create({
    baseURL: 'https://nic.kz/',
    timeout: 15000,
    httpsAgent,
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

  return instance;
};

const getInstance = async () => {
  if (!instance) {
    await initAxios();
  }

  return instance;
};

module.exports = { getInstance, initAxios };
