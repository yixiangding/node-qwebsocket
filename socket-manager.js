module.exports = class SocketManager {
  constructor(server) {
    const WebSocket = require('ws');
    this.ws = new WebSocket.Server({ server: server });
    this.socketsByUserId = new Map();
    this.socketByPrinterId = new Map();
    this.statusCacheByPrinterId = new Map();
    this.mailer = new stmpMailer();
  }

  init() {
    this.setupOnConnection();
  };

  setupOnConnection() {
    this.ws.on('connection', (socket) => {
      this.initiateConnection(socket);
      this.setupConnectionListeners(socket);
      this.setupMessageListeners(socket);
    });
  };

  initiateConnection(socket) {
    console.log('socket connected');
  };

  setupConnectionListeners(socket) {
    socket.on('close', () => {
      console.log('socket disconnected...');
      this.handleDisconnect(socket);
    });

    socket.on('error', function (err) {
      console.log('received error from socket:');
      console.log(err);
    });
  };

  handleDisconnect(socket) {
    const self = this;
    const done = searchInPrinterSockets();
    if (!done) searchInUserSockets();


    /* helper functions */
    function searchInPrinterSockets() {
      self.socketByPrinterId.forEach((printerSocket, printerId) => {
        if (printerSocket === socket) {
          // disconnected socket found
          self.handlePrinterStatusChange({
            status: 'OFFLINE',
            userId: printerSocket.userId,
            printerId: printerSocket.printerId
          });
          self.removeSocketById(printerId, self.socketByPrinterId);
          return true;
        }
      });
      return false;
    }

    function searchInUserSockets() {
      self.socketsByUserId.forEach((userSocketList, userId) => {
        userSocketList.forEach((userSocket, index) => {
          if (done) return true;
          if (userSocket === socket) {
            userSocketList.splice(index, 1);
            return true;
          }
        })
      });
      return false;
    }
  };

  removeSocketById(id, map) {
    map.delete(id);
    console.log('socket deregestered.');
  };
  
  setupMessageListeners(socket) {
    socket.on('message', (message) => {
      console.log('received message: %s', message);
      const parsedMessage = JSON.parse(message);
      this.handleEvent(parsedMessage, socket);
    })
  };

  handleEvent(parsedMessage, socket) {
    const event = parsedMessage.event;
    const payload = parsedMessage.payload;
    if (event === 'SETUP') {
      this.addSocketToAppropriateMap(payload, socket);
      if (payload.socketType === 'printer') {
        this.handlePrinterStatusChange({
          status: 'ONLINE',
          userId: socket.userId,
          printerId: socket.printerId,
          versionNumber: payload.versionNumber
        });
      }
    }
    else if (event === 'web request status cache') {
      if (payload.printerId) {
        this.sendCachedStatus(payload.printerId, socket);
      }
    }
    else if (event === 'printer status change') {
      const { timeStamp, compositeScope, timeElapsed, timeLeft, status } = payload;
      const newPrintEntry = {
        ...payload.jobData,
        compositeScope,
        timeStamp,
        status,
        totalPrintTime: Number(timeElapsed) + Number(timeLeft)
      }
      this.handlePrinterStatusChange(payload);
    }
  };

  addSocketToAppropriateMap(payload, socket) {
    const socketType = payload.socketType;
    const userId = payload.userId;
    const printerId = payload.printerId;
    if (socketType === 'printer') {
      socket.printerId = printerId;
      socket.userId = userId;
      this.addPrinter(printerId, socket);
    }
    else if (socketType === 'web') {
      this.addUser(userId, socket);
    }
  };

  addUser(userId, socket) {
    var socketsList = this.socketsByUserId.get(userId);
    if (socketsList) {
      this.socketsByUserId.get(userId).push(socket);
    } else {
      socketsList = [socket];
      this.socketsByUserId.set(userId, socketsList);
    }
    console.log('user socket registered');
  };

  addPrinter(printerId, socket) {
    this.socketByPrinterId.set(printerId, socket);
    console.log('printer socket registered');
  };

  sendCachedStatus(printerId, socket) {
    const defaultStatus = {
      status: 'OFFLINE',
      timeElapsed: 0,
      timeLeft: 0,
      printerId
    };
    if (printerId) {
      var cache = this.statusCacheByPrinterId.get(printerId);
      if (!cache) {
        console.log('no cache found for printerId: ' + printerId);
        return socket.send(JSON.stringify({
          event: 'get status cache',
          payload: { cache: defaultStatus }
        }));
      }
      socket.send(JSON.stringify({
        event: 'get status cache',
        payload: { cache: cache }
      }))
    }
    else {
      socket.send(JSON.stringify({
        event: 'get status cache',
        payload: { cache: defaultStatus }
      }));
    }
  };

  handlePrinterStatusChange(payload) {
    this.numberizeTime(payload);
    this.sendToUser(payload.userId, payload);
    this.cachePrinterStatus(payload.printerId, payload);
    if (payload && payload.status === 'END' && payload.email) {
      this.mailer.sendJobCompletionNotification(payload.email, payload.jobData.modelName);
    }
  };

  numberizeTime(payload) {
    if (payload.timeElapsed !== undefined) {
      payload.timeElapsed = Number(payload.timeElapsed);
    }
    if (payload.timeLeft !== undefined) {
      payload.timeLeft = Number(payload.timeLeft);
    }
  };

  cachePrinterStatus(printerId, payload) {
    var oldCache = this.statusCacheByPrinterId.get(printerId);
    var cache = {
      status: payload.status,
      timeElapsed: payload.timeElapsed !== undefined ? payload.timeElapsed :
        oldCache ? oldCache.timeElapsed : 0,
      timeLeft: payload.timeLeft !== undefined ? payload.timeLeft :
        oldCache ? oldCache.timeLeft : 0,
      timeStamp: payload.timeStamp,
      printerId: payload.printerId,
      jobData: payload.jobData ? payload.jobData :
        oldCache ? oldCache.jobData : null,
      versionNumber: payload.versionNumber ? payload.versionNumber :
        oldCache ? oldCache.versionNumber : null
    };
    if (payload.status === 'OFFLINE' && oldCache) {
      if (oldCache.status === 'END' || oldCache.status === 'CANCEL') {
        cache.status = oldCache.status;
      }
    }
    this.statusCacheByPrinterId.set(printerId, cache);
  };

  sendToUser(userId, payload) {
    console.log('sending to user:', userId, "| payload:", payload);
    if (!this.socketsByUserId.has(userId)) {
      return console.log('send failed: userId not found:', userId);
    }
    var socketsList = this.socketsByUserId.get(userId);
    console.log('Broadcasting to sockets of user:', userId,
      '| sockets number:', socketsList.length);
    this.broadcastToWebSockets(socketsList, payload);
  };

  broadcastToWebSockets(socketsList, payload) {
    var message = {
      event: 'web status change',
      payload: payload ? payload : {}
    };
    socketsList.forEach(socket => {
      socket.send(JSON.stringify(message));
    });
  }
};
