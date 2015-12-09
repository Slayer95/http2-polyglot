
Description
===========

A module for serving HTTP 1.1/2 and HTTPS connections over the same port.


Requirements
============

* [node.js](http://nodejs.org/) -- v0.12.0 or newer


Install
============

    npm install http2-polyglot


Examples
========

* Simple usage:

```javascript
var httpolyglot = require('http2-polyglot');
var fs = require('fs');

httpolyglot.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
}, function(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end((req.socket.encrypted ? 'HTTPS' : 'HTTP') + ' Connection!');
}).listen(9000, 'localhost', function() {
  console.log('Polyglot server listening on port 9000');
});
```

* Simple redirect of all http connections to https:

```javascript
var httpolyglot = require('http2-polyglot');
var fs = require('fs');

httpolyglot.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
}, function(req, res) {
  if (!req.socket.encrypted) {
    res.writeHead(301, { 'Location': 'https://localhost:9000' });
    return res.end();
  } else if ((req.socket.alpnProtocol || req.socket.npnProtocol) === httpolyglot.protocol) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Welcome, HTTP/2 user!');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Welcome, HTTPS user!');
  }
}).listen(9000, 'localhost', function() {
  console.log('Polyglot server listening on port 9000');
});
```

API
===

Exports
-------

* **Server** - A class similar to https.Server (except instances have `setTimeout()` from http.Server).

* **createServer**(< _object_ >tlsConfig[, < _function_ >requestListener]) - _Server_ - Creates and returns a new Server instance.

* **protocol** - A version string abstracting HTTP/2.
