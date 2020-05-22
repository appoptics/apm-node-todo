'use strict'

const ServerRequest = require('../server-request')

//
// get stats from ao if present
//
class Stats extends ServerRequest {
  constructor () {
    super();
    this.stats = this.ao._stats || {};
    this.getEventStats = () => {return {}};
    if (this.ao.addon && this.ao.addon.Event.getEventStats) {
      this.getEventStats = this.ao.addon.Event.getEventStats;
    }
  }

  describe () {
    return 'get stats';
  }

  //
  // before changing the format of what is returned consider multiload - it depends
  // on some elements of the returned data.
  //
  get (what) {
    const stats = Object.assign({}, this.stats);
    stats.aob = {Event: this.getEventStats()};

    return stats;
  }

}

module.exports = Stats;


