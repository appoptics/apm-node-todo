'use strict';

const ServerRequest = require('../server-request');
const fs = require('fs');
let profiler;
try {
  profiler = require('v8-profiler-next');
} catch (e) {
  profiler = {
    startProfiling () {

    },
    stopProfiling () {
      return {
        export (cb) {
          cb();
        },
        delete () {

        }

      }
    }
  }
}

// keep track of active profile names.
const profiles = new Set();
// keep state associated with active profiles.
const state = {};

//
// the cpu profiling class
//
class Profile extends ServerRequest {
  constructor (opts) {
    super();

    this.opts = Object.assign({}, opts);
  }

  describe () {
    return 'start and stop cpu profiling';
  }

  start (name) {
    // can't start the same profile more than once
    if (profiles.has(name)) {
      return {status: 400};
    }
    profiles.add(name);
    state[name] = {
      start: this.mstime(),
      stop: undefined,
      elapsed: undefined,
      stopProfilingDelta: undefined,
      deleteProfileDelta: undefined,
      exportProfileDelta: undefined,
      writeFileDelta: undefined,
    };
    profiler.startProfiling(name, true);
    return {start: state[name].start};
  }

  stop (name) {
    // can't stop a profile that wasn't started
    if (!profiles.has(name)) {
      return Promise.reject({status: 400});
    }
    profiles.delete(name);
    const st = state[name];
    delete state[name];

    st.stop = this.mstime();
    st.elapsed = st.stop - st.start;

    const profile = profiler.stopProfiling(name);
    st.stopProfilingDelta = this.mstime() - st.stop;

    return new Promise((resolve, reject) => {
      let mark = this.mstime();
      profile.export((error, result) => {
        st.exportProfileDelta = this.mstime() - mark;
        mark = this.mstime();
        profile.delete();
        st.deleteProfileDelta = this.mstime() - mark;
        if (error) {
          return reject(Object.assign({status: 500, error}, st));
        }
        // if the user doesn't want a dump (mostly for testing).
        if (this.opts.noProfileFile) {
          st.noProfileFile = true;
          return resolve(st);
        }
        mark = this.mstime();
        fs.writeFile(`${name}.cpuprofile`, result, error => {
          st.writeFileDelta = this.mstime() - mark;
          if (error) {
            return reject(Object.assign({status: 500, error}, st));
          }
          st.file = `${name}.cpuprofile`;
          resolve(st);
        });
      });
    })

  }
}

module.exports = Profile;
