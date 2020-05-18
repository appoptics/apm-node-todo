'use strict'

const ServerRequest = require('../server-request')

//
// get stats from ao if present
//
class Stats extends ServerRequest {
  constructor () {
    super();
    this.stats = this.ao._stats;
  }

  describe () {
    return 'get stats';
  }

  //
  // before changing the format of what is returned consider multiload - it depends
  // on some elements of the returned data.
  //
  get (what) {
    return this.stats;
  }

}

module.exports = Stats;


