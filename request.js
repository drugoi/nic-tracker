const axios = require('axios');
const tunnel = require('tunnel');

let instance;

const initAxios = async (db) => {
  console.log('🚀 ~ [AXIOS] ready 🟢');
  const { proxy: proxyDbUrl } = await db.collection('settings').findOne({});

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
      config.httpsAgent = httpsAgent(db);

      return config;
    },
    (error) => Promise.reject(error),
  );

  return instance;
};

module.exports = { instance, initAxios };
