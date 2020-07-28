const axios = require('axios');
const tunnel = require('tunnel');

const httpsAgent = tunnel.httpsOverHttp({
  proxy: {
    host: '176.112.157.8',
    port: 5836,
  },
});

const instance = axios.create({
  baseURL: 'https://nic.kz/',
  timeout: 3000,
  httpsAgent,
  proxy: false,
});

module.exports = instance;
