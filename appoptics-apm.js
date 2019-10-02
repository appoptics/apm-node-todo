'use strict'

const {version} = require('appoptics-apm/package.json');
let key;

// try to use the right key for the endpoint.
const collector = process.env.APPOPTICS_COLLECTOR;
if (collector && collector.startsWith('collector-st')) {
  key = process.env.AO_TOKEN_STG;
} else {
  key = process.env.AO_TOKEN_PROD;
}

module.exports = {
  enabled: true,
  traceMode: 1,
  hostnameAlias: '',
  domainPrefix: false,
  serviceKey: `${key}:ao-node-${version}`,
  insertTraceIdsIntoLogs: undefined,
  insertTraceIdsIntoMorgan: undefined,
  createTraceIdsToken: undefined,
  probes: {
    fs: {
      enabled: true
    }
  }
};
