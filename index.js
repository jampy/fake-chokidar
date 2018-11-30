const dgram = require('dgram');
const fs = require("fs");


let watches = [];

// fake-chokidar was made specifically for Webpack and the options used by it.
// The following watch() options are what fake-chokidar expects. It should
// be possible to allow different options, but these would need to be
// implemented first, of course.
const expectedOpts = {
  ignoreInitial: true,
  persistent: true,
  followSymlinks: false,
  depth: 0,  // important
  atomic: false,
  usePolling: undefined,
  interval: undefined,
  binaryInterval: undefined,
  disableGlobbing: true
};


/**
 * Tweaks the "chokidar" module by replacing it's watch() method.
 *
 * This must be called at the very beginning of the program, ie. at the top
 * of your webpack.config.js
 *
 * Available options:
 *
 * `port`: UDP port to listen for events. Defaults to 49494 but you might
 * want to choose a specific port. The port number must match the one used
 * by `fake-chokidar-sender`.
 *
 * `host`: Host to bind the UDP event server on. Defaults to '0.0.0.0' (all
 * interfaces) and should be fine for normal situations.
 *
 * `chokidar`: Reference to the 'chokidar' module. If not given, default
 * Chokidar is used. Normally there is no need to use this option.
 *
 *
 * @param options
 */
exports.inject = function(options) {

  options = options || {};

  // NB: "chokidar" is *not* in our package.json
  const chokidar = options.chokidar || require("chokidar");
  const port = options.port || 49494;
  const host = options.host || "0.0.0.0";

  const server = dgram.createSocket('udp4');

  server.on('message', function (message, remote) {

    try {

      handleMessage(message);

    } catch (e) {

      console.log("fake-chokidar error in 'message' handler:", e);

    }

  });


  server.bind(port, host);

  chokidar.watch = function(path, opts) {

    checkWatchParameters(path, opts);

    const listeners = [];
    const myWatch = { listeners };

    watches.push(myWatch);

    return {

      on: (event, func) => {

        listeners.push({
          path,
          opts,
          event,
          func,
        });

      },

      close: () => {

        watches = watches.filter(x => x !== myWatch);

      }
    };

  };


};


/**
 * Checks whether the given watch() parameters are valid for this Chokidar
 * emulation.
 *
 * Throws exceptions when it finds unusual settings.
 *
 * @param path
 * @param opts
 */
function checkWatchParameters(path, opts) {

  if (typeof path !== "string")
    throw new Error("first argument expected to be a string");

  for (const key of Object.keys(opts)) {

    if (expectedOpts.hasOwnProperty(key) && opts[key] !== expectedOpts[key]) {

      throw new Error("Unexpected value for option " + key + " (" + opts[key] + ")");

    }

  }

}


/**
 * Handles a message received from fake-chokidar-sender.
 *
 * @param message - Raw UDP message.
 */
function handleMessage(message) {

  const payload = JSON.parse(message);
  const { event, path } = payload;

  const basePath = path.substring(0, path.lastIndexOf("/"));

  console.log(payload)

  watches.forEach(({listeners}) => {

    listeners
      .filter(l => l.event === event && l.path === basePath)
      .forEach(l => {

        invokeListener(l, event, path);

      });

  });

}


/**
 * Calls all registered Chokidar listeners matching the event.
 *
 * @param listener
 * @param event
 * @param path
 */
function invokeListener(listener, event, path) {

  const call = stat => listener.func(path, stat);


  if (['add', 'addDir','change'].indexOf(event) >= 0) {

    // 'add', 'addDir' and 'change' events also receive stat() results as second
    // argument when available: http://nodejs.org/api/fs.html#fs_class_fs_stats

    fs.stat(path, (err, stat) => {
      if (stat)
        call(stat);
      else
        console.log("WARNING: Lost event [" + event + " " + path + "] due to" +
          " failed stat()");
    });


  } else {

    call();

  }

}

