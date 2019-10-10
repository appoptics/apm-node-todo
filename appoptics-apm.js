'use strict'

const {version} = require('appoptics-apm/package.json');
let serviceKey;

// try to use the right key for the endpoint.
const collector = process.env.APPOPTICS_COLLECTOR;
if (collector && collector.startsWith('collector-st')) {
  serviceKey = process.env.AO_TOKEN_STG;
} else {
  serviceKey = process.env.AO_TOKEN_PROD;
}

if (serviceKey) {
  serviceKey = `${serviceKey}:ao-node-${version}`
}

module.exports = {
  enabled: true,
  traceMode: 1,
  hostnameAlias: '',
  domainPrefix: false,
  serviceKey,
  insertTraceIdsIntoLogs: undefined,
  insertTraceIdsIntoMorgan: undefined,
  createTraceIdsToken: undefined,
  probes: {
    fs: {
      enabled: true
    }
  }
};
