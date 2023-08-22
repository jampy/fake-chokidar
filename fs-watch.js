/*

connects the fake-chokidar-sender Messages to fs.watch().

Note that we receive chokidar-style events and need to translate them to
fs.watch() events.

Events comparison:


UDP message payload (event, path)           fs.watch() event
------------------------------------------  -------------------------------------------

CREATE NEW FILE:
add /full/path/to/file.txt                  change file.txt

MODIFY FILE:
change /full/path/to/file.txt               change file.txt

RENAME (please note the order of events):
add /full/path/to/file-renamed.txt          rename file.txt
unlink /full/path/to/file.txt               rename file-renamed.txt

DELETE:
unlink /full/path/to/file.txt               rename file.txt


CREATE NEW DIRECTORY:
addDir /full/path/to/dir                    rename dir     (not "rename" !!)

RENAME DIRECTORY:
unlinkDir /full/path/to/dir                 rename dir
addDir /full/path/to/dir-renamed            rename dir-renamed

DELETE DIRECTORY:
unlinkDir /full/path/to/dir                 rename dir



INCOMPATIBILITY WARNING: Please note that *renaming* a file will result in
incorrect "change file-renamed.txt", "rename file.txt" events (wrong event
and wrong order). This probably is not relevant for Webpack/Watchpack.

*/



const fs = require("fs");
const server = require("./server.js");


const origWatch = fs.watch;



exports.injectFsWatch = function(options) {

  const watchers = [];

  if (fs.watch !== origWatch)
    throw new Error('fs.watch() has already been monkeypatched');


  server.initServer(options, message => {

    const { event, path } = JSON.parse(message);

    const [ dir, fn ] = splitDirFn(path);

    //console.log("+++ handleMessage:", event, path, "//", {dir, fn});

    for (const { watchFn, handle } of watchers) {

      if (watchFn === dir) {

        const fswEvent = ['add', 'change'].includes(event) ? 'change' : 'rename';

        //console.log(" ... match", watchFn, "-->", fswEvent, fn)

        handle.emit('change', fswEvent, fn);

      }

    }

  });




  fs.watch = function(watchFn, options=undefined, listener=undefined) {

    if (options) {
      throw new Error('fs.watch() called with "options" arg. This is currently' +
        ' not supported by fake-chokidar.');
    }

    if (listener) {
      throw new Error('fs.watch() called with "listener" arg. This is currently' +
        ' not supported by fake-chokidar.');
    }


    // NB: Webpack 2+ (Watchpack) normally will always be a directory name
    // (not a regular file).


    // We call the original fs.watch() just to get a full featured return
    // value. We don't expect this FSWatcher to invoke any events (even if
    // it does, it's fine). Instead, we will inject our own events.
    const handle = origWatch(watchFn);

    const watchersRef = {
      watchFn,
      handle: handle,
    };

    watchers.push(watchersRef);

    handle.on('close', () => {

      const idx = watchers.indexOf(watchersRef);

      if (idx >= 0)
        watchers.splice(idx, 1);

    });

    return handle;

  }

}


function splitDirFn(fn) {

  const parts = fn.split("/");

  const name = parts.pop();

  return [ parts.join("/"), name ];

}
