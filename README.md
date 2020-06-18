This sample app is based on TodoMVC framework.

TodoMVC is a project which offers the same Todo application implemented using MV* concepts in most of the popular JavaScript MV\* frameworks of today.

## Run the app

To get the app running, follow the instructions below:
- Install and run MongoDB <br/>
	$ sudo apt-get install mongodb <br/>
	$ sudo service mongodb stop <br/>
	$ sudo mkdir $HOME/db ; sudo mongod --dbpath $HOME/db --port 80 --fork --logpath /var/tmp/mongodb <br/>
- Install and run the app <br/>
	$ git clone <git-repo-url> <br/>
	$ cd todo, npm install <br/>
	$ node server.js --ws-ip <IP of machine running the app> --db-ip <IP of machine running mongodb> <br/>

Appoptics
    server.js has been modified to add settings that make it easier to test the appoptics-apm agent in
    a "real" application.
    This can run roughly parallel implementations using express (default), koa, or hapi as the web server
    framework. Not all frameworks support all loggers, but the logger to use can also be set to morgan
    (default), pino, winston, or bunyan. A quick overview of server options can be seen by using the `-h`
    cli option. Complete documentation of command line options is available by reading the code. the
    `get-cli-options.js` file is a good place to start.

    The server responds to many URLs in order to exercise various aspects of AppOptics. The code is the
    documentation.

example - sample rate of 100%, serve port 8088 on localhost: <br/>
  `$ node server -r 100 --ws-ip=localhost:8088`

example - check the server config: <br/>
  `$ curl localhost:8088/config`

example - change the server config on the fly: <br/>
  `$ curl -X PUT localhost:8088/config/metrics/stop`

example - change the metric interval using server config: <br/>
  `$ curl -X PUT localhost:8088/config/metrics/reset:30000`

(see lib/requests/config.js for dynamic configuration options.)

## generating a load against the server

see bmacnaughton/multiload for a test driver that can perform transactions at specific rates against this server.

## todo for todo

- handle mongodb deprecations warnings - http://mongodb.github.io/node-mongodb-native/3.3/reference/unified-topology/
- clean up lib/requests/accounting.js - specifically the time-based accounting can really only handle
one invocation (that's all that's done now) but has some not-to-be-used hooks to enable multiple
time-bases to be accumulated simultaneously.
- capture request count on interval. basically accounting needs to be rethought and fixed to be
more consistent with averages, interval values, and e-moving-avgs.

## License

Everything in this repo is MIT License unless otherwise specified.

Original todomvc-mongodb MIT © Addy Osmani, Sindre Sorhus, Pascal Hartig, Stephen Sawchuk.
Extensions MIT © Bruce MacNaughton
