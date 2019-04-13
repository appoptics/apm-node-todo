'use strict'

const ServerRequest = require('../server-request');
const aws = require('aws-sdk');

//
// the config manipulation class
//
class AwsKinesis extends ServerRequest {
  constructor (options = {}) {
    super();
    this.streamName = options.streamName || 'apm-node-repro-test';
    this.regionName = options.regionName || 'us-east-1';
    this.counts = {
      sent: 0, done: 0, errors: 0
    }
    this.newOptions = options.newOptions || {};

    this.counter = 9872;
    Object.defineProperty(this, 'updateCounter', {
      get () {
        return this.counter += 1;
      }
    })

    aws.config.update({region: this.regionName});
    this.kinesis = new aws.Kinesis(this.newOptions);
  }

  describe () {
    return 'test customer kinesis scenario';
  }

  put (event) {
    if (!event) {
      event = this.makeEvent();
    }

    return new Promise((resolve, reject) => {
      this.counts.sent += 1;
      this.kinesis.putRecord({
        Data: event,
        PartitionKey: 'only-one-shard',
        StreamName: this.streamName,
      },
      (err, data) => {
        this.counts.done += 1;
        if (err) {
          this.counts.errors += 1;
          reject(err);
          return;
        }
        resolve(data);
      })
    })
  }


  makeEvent () {
    const o = Object.assign({}, eventTemplate);
    o.eventDateTimestamp = o.logTimestamp = o.log.timestamp = Date.now();
    o.updateCounter = this.counter;
    return JSON.stringify(o);
  }

  getStats () {
    return this.counts;
  }

}

const eventTemplate = {
  eventSource: 'Kuiper',
  eventDateTimestamp: 1554253242271,
  enrollmentId: 30311234,
  ula: 3002007,
  updateCounter: 9782,
  logTimestamp: 1554253242271,
  log: {
    enrollmentId: 30311234,
    numericUla: 3002007,
    updateCounter: 9782,
    updatedByCustomerId: 6099331,
    timestamp: 1554253242271,
    transition: 9,
    scoreType: 0,
    siaVersionHash: 'oYQCrOM',
    questionAttemptCounter: 1,
    attemptStatus: 0,
    attemptCounter: 251,
    questionCounter: 1
  }
}


module.exports = AwsKinesis;


