'use strict'

const ServerRequest = require('../server-request');

const v8 = require('v8');
const vm = require('vm');

let gc;

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

  get (what) {
    if (what in this) {
      return this[what]()
    }
    return {status: 404}
  }

  rss () {
    return {
      rss: process.memoryUsage().rss,
      ts: new Date().getTime()
    }
  }

  collect () {
    if (!gc) {
      v8.setFlagsFromString('--expose-gc');
      gc = vm.runInNewContext('gc');
    }
    gc();
    return this.rss();
  }
}

module.exports = Memory
