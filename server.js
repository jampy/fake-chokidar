const dgram = require('dgram');


exports.initServer = function(options, handleMessage) {

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

}
