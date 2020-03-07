'use strict'

const ServerRequest = require('../server-request')

const {ExponentialMovingAverage: ExpMovAverage} = require('../ema');

// seconds to ms
const secondsToMs = m => m * 1000;

//
// keep basic accounting for server requests.
//
class Accounting extends ServerRequest {
  constructor (opts = {}) {
    super();
    this.opts = Object.assign({timeBased: false}, opts);

    if (!opts.interval) {
      throw new Error('Accounting constructor missing interval (seconds)');
    }

    this.total = 0;       // total requests
    this.sampled = 0;     // requests sampled

    // recording of the delta values happens every interval seconds.
    this.interval = Math.round(this.opts.interval);

    this.timerIds = [];

    // the ema's alpha (new observation weight)
    this.alpha = opts.alpha || 0.1;

    // two ways to calculate the ema 1) collect a count for each interval
    // and report that count for the interval, e.g. 10 second intervals
    // report an ema for count in 10 seconds and 2) collect counts on an
    // interval but report on a different interval, e.g. 10 second intervals
    // but report an ema over 60 seconds. #2 is not being done now as it
    // adds a significant level of complexity.
    if (opts.timeBase) {
      throw new Error('time-based moving average accounting not yet supported');
    }

    // this is all now going to report counts averaged (using ema) over the
    // interval time period.
    this.averageTimeBases = {
      [this.interval]: {},
    };

    const timeBases = Object.keys(this.averageTimeBases);
    for (let i = 0; i < timeBases.length; i++) {
      const tb = this.averageTimeBases[timeBases[i]];
      tb.totalAverages = new ExpMovAverage(this.alpha);
      tb.sampledAverages = new ExpMovAverage(this.alpha);
      tb.cpuUserPerTx = new ExpMovAverage(this.alpha);
      tb.cpuSystemPerTx = new ExpMovAverage(this.alpha);
      tb.spansActive = new ExpMovAverage(this.alpha);
    }

    // keep track of intervals that have occurred.
    this.intervals = 0
  }

  describe () {
    return 'account for requests: count, memory, cpu';
  }


  count () {
    this.total += 1

    const last = this.ao.lastEvent;
    if (last) {
      // handle pre v8.0.0 agent and v8.0.0 agent
      if (last.event && last.event.getSampleFlag() || last.sampling) {
        this.sampled += 1
      }
    }
  }

  get (timeBase) {
    const tb = this.averageTimeBases[timeBase];
    if (!tb) {
      throw new Error(`requesting unknown timeBase ${timeBase}`);
    }
    return {
      count: this.total,
      sampled: this.sampled,
      totalAverages: fixed(tb.totalAverages.get()),
      sampledAverages: fixed(tb.sampledAverages.get()),
      cpuUserPerTx: fixed(tb.cpuUserPerTx.get(), 0),
      cpuSystemPerTx: fixed(tb.cpuSystemPerTx.get(), 0),
      spansActive: fixed(tb.spansActive.get(), 0),
    };
  }

  startIntervalAverages (opts = {}) {
    // this.interval._repeat is ms value for interval timer. can be
    // adjusted.

    // keep previous values
    let pTotal = this.total
    let pSampled = this.sampled;
    let pCpuUsage = process.cpuUsage()

    const context = {}
    const timerId = setInterval (() => {
      this.intervals += 1
      const cpuUsage = process.cpuUsage()

      const deltaTot = this.total - pTotal
      const deltaSampled = this.sampled - pSampled;
      const deltaU = cpuUsage.user - pCpuUsage.user
      const deltaS = cpuUsage.system - pCpuUsage.system
      const spansActive = this.ao.Span.entrySpanEnters - this.ao.Span.entrySpanExits

      // reset the previous values
      pTotal = this.total
      pSampled = this.sampled;
      pCpuUsage = cpuUsage

      const timeBases = Object.keys(this.averageTimeBases);
      timeBases.forEach(t => {
        // if any traces occurred
        if (deltaTot) {
          const tb = this.averageTimeBases[t];
          tb.totalAverages.update(deltaTot);
          tb.sampledAverages.update(deltaSampled);
          tb.cpuUserPerTx.update(deltaU / deltaTot)
          tb.cpuSystemPerTx.update(deltaS / deltaTot)
          tb.spansActive.update(spansActive)
        }
      })

      if (context.display) {
        context.display()
      }
    }, secondsToMs(this.interval));

    // allow multiple of these to be going but they would screw up
    // others' averages.
    this.timerIds.push(timerId)
    context.timerId = timerId
    return context
  }
}

module.exports = Accounting

function fixed (value, n = 2) {
  return +value.toFixed(n);
}

if (!module.parent) {
  const ao = {tContext: {get: function () {return undefined}}}
  const r = require('../requests')(ao)
  const a = new r.Accounting()

  // generate a constant load of 1/sec
  const id = setInterval(() => {
    a.count()
  }, 1000)
  id

  const ctx = a.startIntervalAverages()

  ctx.display = function () {
    const times = a.averageTimeBases
    const totalAverages = Object.assign({}, a.cpuUserPerTx)
    const formatted = {}
    times.forEach(t => {
      formatted[t] = +totalAverages[t].toFixed(0)
    })
    console.log(formatted)
  }

}
