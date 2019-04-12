'use strict'

//
// base class for requests
//
class ServerRequest {
  constructor (ao) {
    this.ao = ao
    this.pid = process.pid
  }

  // default is just the class name
  describe () {
    return this.constructor.name
  }

  // shorthand
  mstime () {
    return new Date().getTime()
  }

  // wait for promise instead of callback
  wait (ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms)
    })
  }

  // retry a promise returning function max times
  retry (fn, max, errorFunc) {
    return new Promise((resolve, reject) => {
      return fn()
        .then(resolve)
        .catch(e => {
          // if there's an error handling function and it returns
          // falsey then don't retry and just reject the promise.
          if (errorFunc) {
            if (!errorFunc(e)) {
              reject(e);
              return
            }
          }
          if (--max >= 0) {
            this.retry(fn, max)
              .then(resolve)
              .catch(reject)
          }
        })
    })
  }
}

module.exports = ServerRequest
