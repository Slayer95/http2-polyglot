const net = require('net');
const util = require('util');

const http2 = require('http2');
const httpolyglot = require('httpolyglot');
const protocol = require('http2/lib/protocol');

// Logger shim, used when no logger is provided by the user.
function noop() {}
const defaultLogger = {
	fatal: noop,
	error: noop,
	warn : noop,
	info : noop,
	debug: noop,
	trace: noop,

	child: function() { return this; }
};

// When doing NPN/ALPN negotiation, HTTP/1.1 is used as fallback
const supportedProtocols = [protocol.VERSION, 'http/1.1', 'http/1.0'];

// Ciphersuite list based on the recommendations of http://wiki.mozilla.org/Security/Server_Side_TLS
// The only modification is that kEDH+AESGCM were placed after DHE and ECDHE suites
const cipherSuites = [
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'DHE-RSA-AES128-GCM-SHA256',
  'DHE-DSS-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-SHA256',
  'ECDHE-ECDSA-AES128-SHA256',
  'ECDHE-RSA-AES128-SHA',
  'ECDHE-ECDSA-AES128-SHA',
  'ECDHE-RSA-AES256-SHA384',
  'ECDHE-ECDSA-AES256-SHA384',
  'ECDHE-RSA-AES256-SHA',
  'ECDHE-ECDSA-AES256-SHA',
  'DHE-RSA-AES128-SHA256',
  'DHE-RSA-AES128-SHA',
  'DHE-DSS-AES128-SHA256',
  'DHE-RSA-AES256-SHA256',
  'DHE-DSS-AES256-SHA',
  'DHE-RSA-AES256-SHA',
  'kEDH+AESGCM',
  'AES128-GCM-SHA256',
  'AES256-GCM-SHA384',
  'ECDHE-RSA-RC4-SHA',
  'ECDHE-ECDSA-RC4-SHA',
  'AES128',
  'AES256',
  'RC4-SHA',
  'HIGH',
  '!aNULL',
  '!eNULL',
  '!EXPORT',
  '!DES',
  '!3DES',
  '!MD5',
  '!PSK'
].join(':');

function Server(options) {
	options = util._extend({}, options);

	this._log = (options.log || defaultLogger).child({ component: 'http' });
	this._settings = options.settings;

	var start = this._start.bind(this);
	var fallback = this._fallback.bind(this);

	// HTTP2 over TLS (using NPN or ALPN)
	if ((options.key && options.cert) || options.pfx) {
		this._log.info('Creating HTTP/2 server over TLS');
		this._mode = 'tls';
		options.ALPNProtocols = supportedProtocols;
		options.NPNProtocols = supportedProtocols;
		options.ciphers = options.ciphers || cipherSuites;
		options.honorCipherOrder = (options.honorCipherOrder != false);
		this._server = httpolyglot.createServer(options);
		this._originalSocketListeners = this._server.listeners('secureConnection');
		this._server.removeAllListeners('secureConnection');
		this._server.on('secureConnection', function(socket) {
			var negotiatedProtocol = socket.alpnProtocol || socket.npnProtocol;
			// It's true that the client MUST use SNI, but if it doesn't, we don't care, don't fall back to HTTP/1,
			// since if the ALPN negotiation is otherwise successful, the client thinks we speak HTTP/2 but we don't.
			if (negotiatedProtocol === protocol.VERSION) {
				start(socket);
			} else {
				fallback(socket);
			}
		});
		this._server.on('request', this.emit.bind(this, 'request'));
	}

	// HTTP2 over plain TCP
	else if (options.plain) {
		this._log.info('Creating HTTP/2 server over plain TCP');
		this._mode = 'plain';
		this._server = net.createServer(start);
	}

	// HTTP/2 with HTTP/1.1 upgrade
	else {
		this._log.error('Trying to create HTTP/2 server with Upgrade from HTTP/1.1');
		throw new Error('HTTP1.1 -> HTTP2 upgrade is not yet supported. Please provide TLS keys.');
	}

	this._server.on('close', this.emit.bind(this, 'close'));
}
util.inherits(Server, http2.Server);

function createServerTLS(options, requestListener) {
	if (typeof options === 'function') {
		throw new Error('options are required!');
	}
	if (!options.pfx && !(options.key && options.cert)) {
		throw new Error('options.pfx or options.key and options.cert are required!');
	}
	options.plain = false;

	var server = new Server(options);

	if (requestListener) {
		server.on('request', requestListener);
	}

	return server;
}

exports.Server = Server;
exports.createServer = createServerTLS;
exports.protocol = protocol.version;
