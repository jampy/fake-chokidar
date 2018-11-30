const PORT = 53999;
const HOST = '0.0.0.0';

const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const fs = require("fs");


const chokidar = require("chokidar");  // altough no dependency!

let watches = [];

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


const supportedEvents = [
  "add", "addDir", "change", "unlink", "unlinkDir", "error"
];


chokidar.watch = function(path, opts) {

  if (typeof path !== "string")
    throw new Error("first argument expected to be a string");

  for (const key of Object.keys(opts)) {

    if (expectedOpts.hasOwnProperty(key) && opts[key] !== expectedOpts[key]) {

      throw new Error("Unexpected value for option " + key + " (" + opts[key] + ")");

    }

  }

  const listeners = [];

  const myWatch = { listeners };

  watches.push(myWatch);

  return {

    on: (event, func) => {

      if (supportedEvents.indexOf(event) < 0)
        throw new Error("Event '" + event + "' not supported by Fake Chokidar");

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



server.on('message', function (message, remote) {

  try {

    handleMessage(message);

  } catch (e) {

    console.log("Fake Chokidar error in 'message' handler:", e);

  }

});


function handleMessage(message) {

  const payload = JSON.parse(message);
  const { event, path } = payload;

  const basePath = path.substring(0, path.lastIndexOf("/"));

  //console.log(payload)

  watches.forEach(({listeners}) => {

    listeners
      .filter(l => l.event === event && l.path === basePath)
      .forEach(l => {

        invokeListener(l, event, path);

      });

  });

}


function invokeListener(listener, event, path) {

  //console.log("INVOKE", event, "FOR", path /* , "-->", listener */)

  const call = stat => {

    //console.log(event, " @@ ", path, stat)

    listener.func(path, stat);

  };


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


function getRelPath(listener, path) {

  if (path.substr(0, listener.path.length) !== listener.path)
    throw new Error("relPath wrong prefix (expected '" + listener.path + "' in '" + path + "')");

  return path.substr(listener.path.length + 1);

}


server.bind(PORT, HOST);
