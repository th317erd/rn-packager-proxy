var http = require('http'),
    httpProxy = require('http-proxy'),
    transformProxy = require('./transformer'),
    zlib = require('zlib');

var proxyServer = httpProxy.createProxyServer({
  target: {
    host: 'localhost',
    port: 8081
  },
  ws: true
});

var server = http.createServer(transformProxy({
  body: function(data, req) {
    var isBundleScript = req.url.match(/^\/index.\w+.bundle/),
        isDebuggerScript = req.url.match(/^\/debuggerWorker.js/);

    console.log('Sending: ', req.url);
    if (isBundleScript || isDebuggerScript) {
      var buf = zlib.gunzipSync(data).toString();

      if (isBundleScript) {
        buf = buf.replace(/(defineProperty\s*\(global\s*,\s*['"])XMLHttpRequest(["'])/g, '$1FakeXMLHttpRequest$2');
      } else if (isDebuggerScript) {
        buf = buf.replace(/(importScripts\s*\(\s*)message.url(\s*\))/g, '$1message.url.replace(/8081/g,\'8082\')$2');
      }

      return zlib.gzipSync(buf);
    }

    return data;
  },
  next: function(req, res) {
    proxyServer.web(req, res);
  }
}));

server.on('upgrade', function(req, socket, head) {
  console.log('Upgrading websockets!');
  proxyServer.ws(req, socket, head);
});

server.listen(8082);


