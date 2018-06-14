var WebSocket = require('ws');
var ClientSocket = require('./ClientSocket.js');

var WebSocketServer = function (server) {
  this.ws = new WebSocket.Server({ server: server });
};


WebSocketServer.prototype.on = function (eventName, eventHandler) {
  if (eventName === "connection") {
    this.ws.on('connection', function (socket) {
      var clientSocket = new ClientSocket(socket);
      eventHandler(clientSocket);
    });
  }
};

module.exports = WebSocketServer;


