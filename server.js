#!/usr/bin/env node
'use strict'

const v8 = require('v8');
/**
 * @license
 * Everything in this repo is MIT License unless otherwise specified.
 *
 * Copyright (c) Addy Osmani, Sindre Sorhus, Pascal Hartig, Stephen  Sawchuk, Google, Inc.
 * Copyright (c) Bruce MacNaughton, Solarwinds, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

//==============================================================================
// set up ======================================================================
//==============================================================================

const {argv, showHelp} = require('./lib/get-cli-options')
if (argv.help) {
  showHelp()
  process.exit(0)
}

const staging = (process.env.APPOPTICS_COLLECTOR || '').startsWith('collector-stg.');

// this sets up with either a real appoptics-apm or a dummy appoptics-apm
const serverConfig = require('./lib/get-server-config')(argv.appoptics);
const ao = serverConfig.ao

// standard require files
const fs = require('fs')

// request wraps the individual request constructors and fills in ao for them
// there's certainly a better way to do this but i haven't figured it out yet.
const Requests = require('./lib/requests')(ao)
const kAcctSecs = 10;
const accounting = new Requests.Accounting({interval: kAcctSecs});

// get host name for metrics and general status/config
let hostname = fs.readFileSync('/etc/hostname', 'utf8')
if (hostname[hostname.length - 1] === '\n') {
  hostname = hostname.slice(0, -1)
}

const version = require('./package.json').version

//==============================================================================
// process command line options ================================================
//==============================================================================

function defaultMissing (host, port) {
  // maybe they just gave a port?
  if (typeof host === 'number') {
    return `localhost:${host}`
  }
  // if no port add the default
  if (!~host.indexOf(':')) {
    return `${host}:${port}`
  }
  // nothing to do
  return host
}
// for backwards compability look for be_ip before db-ip
const mongoHost = defaultMissing(process.env.AO_MONGODB || argv['db-ip'] || argv.d, 27017)

// for backwards compatibility look for fe_ip before ws-ip
const webServerHost = defaultMissing(argv.fe_ip || argv.w, 8088)

// get log setttings
const logger = argv.logger;
const logLevel = argv['log-level'];

//
// appoptics settings
//

// use percent rate from r first, then rate as fraction of 1000000
// and finally default to 1000000.
const rate = 'r' in argv ? argv.r * 10000 : argv.rate || 1000000;
ao.sampleRate = rate;


const modeMap = {0: 0, 1: 1, never: 0, always: 1, disabled: 0, enabled: 1}
if ('trace-mode' in argv && argv.t in modeMap) {
  ao.traceMode = argv.t
}

// TODO BAM fix insert options.
//if ('insert' in argv) {
//  ao.cfg.insertTraceIdsIntoLogs = argv.insert;
//  ao.cfg.insertTraceIdsIntoMorgan = argv.insert;
//}
const sk = process.env.APPOPTICS_SERVICE_KEY || 'xyzzy:xyzzy';
const [serviceKey, service] = sk.split(':');

//========================================================================
// finally host metrics configuration
//========================================================================

// these are considered the "base" and are filled in at the end of initialization.
// that way most of the application's base memory usage has been allocated. oboe
// doesn't expose the event queue size (currently 10,000) so it's saved just after
// initialization as an approximation of the value.
const memBase = {
  rss: 0,
  heapUsed: 0,
  heapTotal: 0,
  eventQueueFree: 0,
};

//==================================================================================
// if supplied, metrics must be a valid appoptics token (not service key) or metrics
// won't be collected.
//==================================================================================
if (argv.metrics) {
  const Metrics = require('./lib/metrics')

  // set key, endpoint, and default tags. kind of kludgy decision-making as to
  // which endpoint to use; it defaults to production.
  const prefix = staging ? 'aostg-' : '';
  const m = new Metrics(
    argv.metrics,
    `https://${prefix}api.appoptics.com/v1/measurements`,
    {
      image_name: `${hostname}-${ao.version}`,
      service,
    }
  )

  function addMetrics (metrics, prefix, object) {
    // first make the metrics based on object, using prefix
    const o = {};
    const properties = Object.keys(object);
    for (let i = 0; i < properties.length; i++) {
      o[prefix + properties[i]] = object[properties[i]];
    }
    return Object.assign(metrics, o);
  }

  //
  //function addUrlMetrics (prefix, urlMetricsMap, metrics) {
  //  for (let url of urlMetricsMap.keys()) {
  //    const m = urlMetricsMap.get(url);
  //    url = url.replace(/\//g, ':');
  //    url = url.replace(/\*/g, '-');
  //    metrics[prefix + url + '.count'] = m.count;
  //    metrics[prefix + url + '.time'] = m.time / 1e3 / m.count;
  //    metrics[prefix + url + '.events'] = m.events / m.count;
  //  }
  //}

  let prevTopSpansExited = 0;

  function getMetrics (deltaTime) {
    const stats = accounting.get(kAcctSecs);
    const metrics = {
      [`todo.${kAcctSecs}sec.total.transactions`]: stats.totalAverages,
      [`todo.${kAcctSecs}sec.total.sampled`]: stats.sampledAverages,
      [`todo.${kAcctSecs}sec.cpuUser.perTransaction`]: stats.cpuUserPerTx,
      [`todo.${kAcctSecs}sec.cpuSystem.perTransaction`]: stats.cpuSystemPerTx,
      [`todo.${kAcctSecs}sec.apm.lastRate`]: stats.lastRate || 0,
      //[`todo.${kAcctSecs}sec.fillRequests`]: stats.fillRequests,
      //[`todo.${kAcctSecs}sec.copyFills`]: stats.copyFills,
      //[`todo.${kAcctSecs}sec.syncFills`]: stats.syncFills,
      //[`todo.${kAcctSecs}sec.bufferFills`]: stats.bufferFills,
    };
    const mu = process.memoryUsage();
    addMetrics(metrics, 'todo.memory.', mu);
    addMetrics(metrics, 'todo.memory.v8.heap.', v8.getHeapStatistics());

    // reset these to the lowest values seen. that's the effective
    // base.
    if (memBase.rss > mu.rss) memBase.rss = mu.rss;
    if (memBase.heapTotal > mu.heapTotal) memBase.heapTotal = mu.heapTotal;
    if (memBase.heapUsed > mu.heapUsed) memBase.heapUsed = mu.heapUsed;

    const delta = {
      rss: mu.rss - memBase.rss,
      heapUsed: mu.heapUsed - memBase.heapUsed,
      heapTotal: mu.heapTotal - memBase.heapTotal,
    }

    // take a stab at delta memory usage.
    addMetrics(metrics, 'todo.memory.delta.', delta);

    // eventsCreated: 0,       // total events created
    // eventsActive: 0,        // event.send() has not been called

    // spansCreated: 0,        // total spans created
    // topSpansCreated: 0,     // total entry spans (traces) created
    // topSpansActive: 0,      // topSpans: span.enter() called but not span.exit()
    // otherSpansActive: 0,    // not-topSpan: span.enter() called but not span.exit()

    //
    // N.B. many metrics are protected by checks to see if they exist so todo
    // remains compatible with previous versions of the agent that don't have
    // those metrics.
    //

    if (ao._stats && ao._stats.event) {
      addMetrics(metrics, 'todo.agent.event.', ao._stats.event);
      addMetrics(metrics, 'todo.agent.span.', ao._stats.span);
      const topSpansExited = ao._stats.span.topSpansExited - prevTopSpansExited;
      prevTopSpansExited = ao._stats.span.topSpansExited;
      metrics['todo.agent.span.tracesPerSecond'] = topSpansExited / (deltaTime / 1000);

      // change Infinity to log counts at some number of
      // active events.
      if (ao._stats.event.active >= 20000 && ao._stats.unsentEvents) {
        const counts = {};
        for (const u of ao._stats.unsentEvents) {
          const k = `${u[0].Layer}:${u[0].Label}`;
          if (!(k in counts)) {
            counts[k] = 1;
          } else {
            counts[k] += 1;
          }
        }
        console.log(counts);
        process.exit(1);
      }
    }

    if (ao.addon) {
      if (ao.addon.Event.getEventStats) {
        const es = ao.addon.Event.getEventStats(0x1);
        addMetrics(metrics, 'todo.aob.eventCounts.', es);
      }
      const oboeStats = ao.addon.Config.getStats();
      metrics['todo.oboe.eventQueue'] = 10000 - oboeStats.eventQueueFree;
    }
    // skip this array-containing object for now.
    //addMetrics(metrics, 'todo.memory.v8.heap.space.', v8.getHeapSpaceStatistics());
    //const spanMetrics = ao.Span.getMetrics('clear');
    //addMetrics(metrics, 'todo.span.', spanMetrics);
    //metrics['todo.span.msPerTopSpan'] = spanMetrics.topSpanTime / 1e3 / spanMetrics.topSpanExits;
    //metrics['todo.span.msPerHttpSpan'] = spanMetrics.httpSpanTime / 1e3 / spanMetrics.httpSpanCount;
    //metrics['todo.span.eventsPerSpan'] = spanMetrics.topSpanEvents / spanMetrics.topSpanExits;
    //
    //if (ao.Span.urlMap) {
    //  addUrlMetrics('todo.span.endpoints.', ao.Span.urlMap, metrics);
    //  ao.Span.urlMap = new Map();
    //}
    return {metrics};
  }

  function metricsSent (r) {
    if (r.statusCode >= 400) {
      console.log(r);
    }
  }

  const ctx = m.sendOnInterval(10000, getMetrics, metricsSent);

  // could work on restarting but not sure why
  ctx.promise.catch(e => {
    console.log(e)
  })
}

// setup annotations as well
const Annotations = require('./lib/annotations');
const annotationsOpts = {};
if (staging) {
  annotationsOpts.url = 'https://my-stg.appoptics.com/v1/annotations';
}
const annotations = new Annotations(serviceKey, annotationsOpts);

//====================================================================================
// force garbage collections at these intervals if possible. save interval timer so it
// can be stopped under program control at if that gets implemented.
//====================================================================================
let gcInterval; // eslint-disable-line no-unused-vars
if (argv.gc) {
  if (typeof global.gc === 'function') {
    if (typeof argv.gc === 'number') {
      gcInterval = setInterval(function () {
        global.gc();
      }, argv.gc * 1000);
    } else {
      console.error(`--gc=${argv.gc} doesn't specific a number, ignoring`);
    }
  } else {
    console.log('global.gc is not a function, ignoring --gc');
  }
}


//
// finally get the ports needed
//
let port
let host
let httpsPort = argv['https-port'];
if (!argv.heroku) {
  host = webServerHost.split(':')
  port = +host[1]
  host = host[0]
} else if (process.env.WEBSITE_SITE_NAME) {
  port = process.env.PORT;
} else {
  port = process.env.PORT
}

//==============================================================================
// set up the framework ========================================================
//==============================================================================

const staticFiles = {
  '/js': '/js',
  '/bower_components': '/bower_components'
}

// get the lower level api that knows nothing of web server frameworks.
const dbName = process.env.TODO_DBNAME || service.replace(/\./g, '-');
const todoapi = new Requests.TodoApi(mongoHost, {dbName});

// get the Event.last formatter for insertion into logs
const traceToken = ao.getFormattedTraceId;

const options = {
  staticFiles,
  Requests,
  accounting,
  todoapi,
  host,
  httpPort: port,
  httpsPort: !argv['no-https'] && httpsPort,
  traceToken,
  logger,
  awsKinesisOpts: {newOptions: {correctClockSkew: true}}, // maxRetries: n (default is maybe 3?)
}

const frameworkSelection = argv.f || 'express'
let framework
let config


//==============================================================================
//==============================================================================
// get the server running ======================================================
//==============================================================================
//==============================================================================

if (frameworkSelection === 'express') {
  framework = require('./frameworks/express')
  config = framework.init(options)

} else if (frameworkSelection === 'koa') {
  framework = require('./frameworks/koa')
  config = framework.init(options)

} else if (frameworkSelection === 'hapi') {
  framework = require('./frameworks/hapi')
  config = framework.init(options)

} else {
  console.error(`invalid framework ${argv.f}`)
  showHelp()
  process.exit(1)
}

// the frameworks return a promise because the initialization
// is not synchronous.
config.then(r => {
  const frameworkConfig = framework.config
  const frameworkSettings = framework.settings

  frameworkSettings.logLevel = logLevel;

  // https is optional
  if (r.httpsStatus) {
    console.warn('https failed to initialize', r.httpsStatus)
    httpsPort = 'NA';
  } else if (argv['no-https']) {
    httpsPort = 'NA';
  }

  // http is not optional
  if (r.httpStatus) {
    throw r.httpStatus
  }

  //const isatty = require('tty').isatty
  //const tty = [isatty(process.stdout.fd) ? 'on a tty' : 'not a tty']
  const https = '(https:' + httpsPort + ')'
  const line = `todo ${version} listening on ${webServerHost} ${https}`;
  const dashes = Buffer.alloc(line.length, '-').toString()
  console.log(dashes)
  console.log(line)

  const fs = frameworkSelection
  const fv = frameworkConfig.version
  const av = `${ao.version}${ao.cfg.enabled ? '' : ' (disabled)'}`;
  const bv = ao.addon.version
  const ov = ao.addon.Config.getVersionString()
  console.log(`${fs} ${fv} ${logger} (logging ${logLevel})`);
  console.log(`active: apm ${av}, bindings: ${bv} oboe ${ov}`);

  console.log(`sample rate ${ao.sampleRate}, traceMode ${ao.traceMode}`)
  console.log(`@${new Date().toISOString()}`);
  console.log(dashes)

  accounting.startIntervalAverages()

  // finally create an annotation detailing what started.
  const streamName = 'todo-server-started';
  const title = `av ${av}, bv ${bv}, ov ${ov}`;
  const os = require('os');
  const opts = {source: os.hostname()};
  if (argv.desc) {
    opts.description = argv.desc;
  }
  annotations.send(streamName, title, opts);

  // set base levels now so there's data of some sort right away.
  const m = process.memoryUsage();
  memBase.rss = m.rss;
  memBase.heapTotal = m.heapTotal;
  memBase.heapUsed = m.heapUsed;

}).catch(e => {
  console.error(`${frameworkSelection} framework initialization error`, e)
  process.exit(1)
})

// taken from appoptics test suite. these are not valid for any real
// servers - only used for local testing.
const sslInfo = { // eslint-disable-line
  key: '-----BEGIN RSA PRIVATE KEY-----\nMIICXQIBAAKBgQCsJU2dO/K3oQEh9wo60VC2ajCZjIudc8cqHl9kKNKwc9lP4Rw9\nKWso/+vHhkp6Cmx6Cshm6Hs00rPgZo9HmY//gcj0zHmNbagpmdvAmOudK8l5Npzd\nQwNROKN8EPoKjlFEBMnZj136gF5YAgEN9ydcLtS2TeLmUG1Y3RR6ADjgaQIDAQAB\nAoGBAJTD9/r1n5/JZ+0uTIzf7tx1kGJh7xW2xFtFvDIWhV0wAJDjfT/t10mrQNtA\n1oP5Fh2xy9YC+tZ/cCtw9kluD93Xhzg1Mz6n3h+ZnvnlMb9E0JCgyCznKSS6fCmb\naBz99pPJoR2JThUmcuVtbIYdasqxcHStYEXJH89Ehr85uqrBAkEA31JgRxeuR/OF\n96NJFeD95RYTDeN6JpxJv10k81TvRCxoOA28Bcv5PwDALFfi/LDya9AfZpeK3Nt3\nAW3+fqkYdQJBAMVV37vFQpfl0fmOIkMcZKFEIDx23KHTjE/ZPi9Wfcg4aeR4Y9vt\nm2f8LTaUs/buyrCLK5HzYcX0dGXdnFHgCaUCQDSc47HcEmNBLD67aWyOJULjgHm1\nLgIKsBU1jI8HY5dcHvGVysZS19XQB3Zq/j8qMPLVhZBWA5Ek41Si5WJR1EECQBru\nTUpi8WOpia51J1fhWBpqIbwevJ2ZMVz0WPg85Y2dpVX42Cf7lWnrkIASaz0X+bF+\nTMPuYzmQ0xHT3LGP0cECQQCqt4PLmzx5KtsooiXI5NVACW12GWP78/6uhY6FHUAF\nnJl51PB0Lz8F4HTuHhr+zUr+P7my7X3b00LPog2ixKiO\n-----END RSA PRIVATE KEY-----',
  cert: '-----BEGIN CERTIFICATE-----\nMIICWDCCAcGgAwIBAgIJAPIHj8StWrbJMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\nBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX\naWRnaXRzIFB0eSBMdGQwHhcNMTQwODI3MjM1MzUwWhcNMTQwOTI2MjM1MzUwWjBF\nMQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50\nZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKB\ngQCsJU2dO/K3oQEh9wo60VC2ajCZjIudc8cqHl9kKNKwc9lP4Rw9KWso/+vHhkp6\nCmx6Cshm6Hs00rPgZo9HmY//gcj0zHmNbagpmdvAmOudK8l5NpzdQwNROKN8EPoK\njlFEBMnZj136gF5YAgEN9ydcLtS2TeLmUG1Y3RR6ADjgaQIDAQABo1AwTjAdBgNV\nHQ4EFgQUTqL/t/yOtpAxKuC9zVm3PnFdRqAwHwYDVR0jBBgwFoAUTqL/t/yOtpAx\nKuC9zVm3PnFdRqAwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOBgQBn1XAm\nAsVdXKr3aiZIgOmw5q+F1lKNl/CHtAPCqwjgntPGhW08WG1ojhCQcNaCp1yfPzpm\niaUwFrgiz+JD+KvxvaBn4pb95A6A3yObADAaAE/ZfbEA397z0RxwTSVU+RFKxzvW\nyICDpugdtxRjkb7I715EjO9R7LkSe5WGzYDp/g==\n-----END CERTIFICATE-----'
}

