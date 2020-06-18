'use strict'

//
// works very well for average based on number of events
// for the sampling time period.
//
// https://nestedsoftware.com/2018/04/04/exponential-moving-average-on-streaming-data-4hhl.24876.html
//
// alpha ranges from 0 to 1. it is the weight to assign the most recent
// observation while 1 - alpha is the weight for all the previous observations.
// if alpha = 1 then the last observation is the average. if alpha = 0 no new
// observations will be added to the average and it will remain its intial
// value.
//
class ExponentialMovingAverage {
  constructor (alpha, mean) {
    this.alpha = alpha;    // alpha is the weight of the most recent term
    this.beta = 1 - alpha; // beta is the weight of the previous terms

    // it takes a while for the 0 to work it's way out of the average but
    // there's not much to do about it if the estimated mean is not known.
    this.mean = mean;
  }

  update (newValue) {
    // it's a check every update but shortens the time for a 0 starting mean
    // to work its way out of the average.
    if (this.mean === undefined) {
      this.mean = newValue;
    }
    // get trailing portion of the mean
    const redistributedMean = this.beta * this.mean;
    // get the new portion of the mean
    const meanIncrement = this.alpha * newValue;
    // merge then into the new mean
    const newMean = redistributedMean + meanIncrement;

    return (this.mean = newMean);
  }

  get () {
    return this.mean || 0;
  }
}

//
// in theory works better when the sampling time period differs
// from the desired moving average period. e.g., i sample every 10
// seconds but want a 60 second moving average.
//
/*
class EMA {
  constructor (timespan) {
    this.timespan = timespan
    this.ma = 0
    this.init = false
  }

  update (deltaT, value) {
    if (!this.init) {
      this.init = true
      this.ma = value
      return this.ma
    }

    const alpha = 1 - Math.exp(-deltaT / this.timespan)

    this.ma = alpha * value + (1 - alpha) * this.ma

    return this.ma
  }

  get () {
    return this.ma
  }

}
// */

module.exports = {
  ExponentialMovingAverage,
  //EMA
}

