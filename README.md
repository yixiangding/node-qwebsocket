# node-qwebsocket
Node.js event-driven server-side web socket, perfectly supporting QT QWebSocket as client.
# Installing
`npm install --save node-websocket-qt`
# Usage
### Basic example
#### sever side 
```javascript
const hostname = '127.0.0.1';
const port = 4000;
const http = require('http');
const server = http.createServer(function (req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World!\n');
});
server.listen(port, hostname, function () {
  console.log('Server running at http://%s:%s/', hostname, port);
});

const WebSocketServer = require('node-websocket-qt');
const socketServer = new WebSocketServer(server);
socketServer.on('connection', function (socket) {
  console.log('socket connected!');
  socket.on('close', function () {
    console.log('socket closed...');
  });
});
```
#### client side (QT)
```cpp
QWebSocket webSocket;
webSocket.open(QUrl("﻿ws://127.0.0.1:4000"));
```

### Receive and emit customized event
#### server side
```javascript
const socketServer = new WebSocketServer(server);
socketServer.on('connection', function (socket) {
  socket.on('setup', function (data) {
    console.log('setup event: %s', JSON.stringify(data, null, 2));
    socket.emit('response', { message: 'Hello Client!' });
  });
});
```
#### client side
```cpp
connect(&webSocket, &QWebSocket::connected, this, &SocketManager::onConnected, Qt::UniqueConnection);
connect(&webSocket, &QWebSocket::textMessageReceived, this, &SocketManager::onTextMessageReceived, Qt::UniqueConnection);
```
in `onConnected()` SLOT:
```cpp
QJsonObject payload;
payload["content"] = "it's setup";
QJsonObject message;
message["event"] = event;
message["payload"] = payload;
QJsonDocument doc(message);
QByteArray bytes = doc.toJson();
webSocket.sendTextMessage(QString(bytes));
```
in `onTextMessageReceived(message)` SLOT:
```cpp
qDebug() << message;
```
Sending/receiving in QT is structured as:
```javascript
{
  event: <eventName>,
  payload: {
    <...payloadContent>
  }
}
```
### Receiving raw data
```javascript
socket.on('connection', function (socket) {
  socket.on('message', function (data) {
    console.log('received raw message: %s', JSON.stringify(data, null, 2));
  });
});
```
# License
[MIT](https://github.com/yixiangding/node-websocket-qt/blob/master/LICENSE)
