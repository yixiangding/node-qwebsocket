var ClientSocket = function (socket) {
  this.registeredEventHandlers = {};
  this.socket = socket;
  var self = this;
  this.socket.on('message', function (message) {
    var parsedMessage = JSON.parse(message);
    var eventName = parsedMessage['event'];
    var payload = parsedMessage['payload'];
    var eventHandler = self.registeredEventHandlers[eventName];
    if (eventHandler !== undefined) {
      eventHandler(payload);
    }
    else {
      console.error("Uncaught event: %s", eventName);
    }
  })
};

ClientSocket.prototype.on = function (eventName, eventHandler) {
  if (eventName === 'close') {
    this.socket.on('close', eventHandler);
  }
  else if (eventName === 'error') {
    this.socket.on('error', eventHandler);
  }
  else if (eventName === 'message') {
    this.socket.on('message', eventHandler);
  }
  else {
    this.registeredEventHandlers[eventName] = function (payload) {
      return eventHandler(payload);
    };
  }
};

ClientSocket.prototype.emit = function (eventName, payload) {
  this.socket.send(JSON.stringify({
    event: eventName,
    payload: payload
  }));
};

module.exports = ClientSocket;