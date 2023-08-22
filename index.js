
exports.inject = exports.injectChokidar = function(options) {

  return require("./chokidar").inject(options);

};


exports.injectFsWatch = function(options) {

  return require("./fs-watch").injectFsWatch(options);

};
