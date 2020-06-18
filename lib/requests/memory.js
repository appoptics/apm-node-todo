'use strict'

const v8 = require('v8');

const ServerRequest = require('../server-request')

//
// the config manipulation class
//
class Memory extends ServerRequest {
  constructor () {
    super()
  }

  describe () {
    return 'get memory data'
  }

  async get (what) {
    let param;
    [what, param] = what.split(':');
    if (what in this) {
      return this[what](param);
    }
    return {status: 404};
  }

  async gc () {
    if (global.gc) {
      global.gc();
      return {gc: 'initiated'};
    }
    return {status: 404, gc: 'not exposed'};
  }

  async rss () {
    return {
      rss: process.memoryUsage().rss,
      ts: Date.now(),
    }
  }

  async 'heap-statistics' () {
    return {
      heapStatistics: v8.getHeapStatistics()
    }
  }

  async 'heap-space-statistics' () {
    return {
      heapSpaceStatistics: v8.getHeapSpaceStatistics()
    }
  }

  async 'trace-gc' (seconds) {
    const secs = Number(seconds);
    if (!secs) {
      return {status: 422, error: `seconds must be a number, not "${seconds}"`};
    }
    v8.setFlagsFromString('--trace-gc');
    setTimeout(() => {
      v8.setFlagsFromString('--notrace-gc');
    }, secs * 1000);

    return {'trace-gc': 'initiated'};
  }

  async 'write-heap-snapshot' (name) {
    // if name isn't supplied a default is generated.
    return v8.writeHeapSnapshot(name);
  }
}

module.exports = Memory
