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
    return Date.now();
  }

  // wait for promise instead of callback
  wait (ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms)
    })
  }

  // retry a promise returning function max times
  retry (fn, max, errorFunc) {
    const f = async () => {
      let error;
      for (let i = 0; i < max; i++) {
        try {
          return await fn();
        } catch (e) {
          if (this.debugging) {
            // eslint-disable-next-line
            debugger;
          }
          console.log(`caught ${i}`)
          if (errorFunc && !errorFunc(e)) {
            throw e;
          }
          error = e;
        }
      }
      console.log('out of retries');
      throw error;
    }
    return f()
  }
}

module.exports = ServerRequest
