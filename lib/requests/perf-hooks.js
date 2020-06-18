'use strict'

const ServerRequest = require('../server-request')


const hooks = {
  event: 'Event',
}

//
// perf_hooks manipulation
//
class PerfHooks extends ServerRequest {
  constructor () {
    super();
  }

  describe () {
    return 'get and set various configuration settings'
  }

  //
  // before changing the format of what is returned consider multiload - it depends
  // on some elements of the returned data.
  //
  enable (what) {
    if (what in hooks) {
      const r = this.ao[hooks[what]].perfTrace('enable');
      return {[what]: r};
    }
    return {status: 404, message: `unknown perf hook ${what}`};
  }

  disable (what) {
    if (what in hooks) {
      const r = this.ao[hooks[what]].perfTrace('disable');
      return {[what]: r};
    }
    return {status: 404, message: `unknown perf hook ${what}`};
  }

  fetch (what) {
    if (what in hooks) {
      const r = this.ao[hooks[what]].perfTrace('fetch');
      return {[what]: r};
    }
    return {status: 404, message: `unknown perf hook ${what}`};
  }

}

module.exports = PerfHooks;


