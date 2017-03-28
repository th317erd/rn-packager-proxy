var util = require("util");
var stream = require("stream");

var TransformerStream = function (transformerFunction, req) {
  this.transformerFunction = transformerFunction;
  this.req = req;
  this.readable = true;
  this.writable = true;
  this.chunks = [];
};

util.inherits(TransformerStream, stream);

TransformerStream.prototype.write = function(data) {
  if (data)
    this.chunks.push(data);
};

TransformerStream.prototype.end = function(data) {
  if (data)
    this.chunks.push(data);

  self = this;
  var ret = this.transformerFunction(Buffer.concat(this.chunks), this.req);
  self.emit("data", ret);
  self.emit("end");
};


module.exports = function transformerProxy(_options) {
	var options = _options || {},
			transformerFunction = options.body,
			headerFunction = options.headers,
			next = options.next;

	if (!transformerFunction) {
		transformerFunction = function(data) { 
	  	return data
	  };
	}

  return function transformerProxy(req, res) {
    var transformerStream = new TransformerStream(transformerFunction, req);

    var resWrite = res.write.bind(res);
    var resEnd = res.end.bind(res);
    var resWriteHead = res.writeHead.bind(res);

    res.write = function(data, encoding) {
      transformerStream.write(data, encoding);
    };

    res.end = function(data, encoding) {
      transformerStream.end(data, encoding);
    };

    transformerStream.on('data', function(buf) {
      resWrite(buf);
    });

    transformerStream.on('end', function() {
      resEnd();
    });

    res.writeHead = function(code, statusMessage, _headers) {
      res.removeHeader('Content-Length');
      
      var headers = _headers || {},
      		args = new Array(arguments.length);

      for (var i = 0, il = arguments.length; i < il; i++)
      	args[i] = arguments[i];

      if (typeof headerFunction === 'function') {
        headers = headerFunction(req, res, headers);
        delete headers['content-length'];
      }

      args[2] = headers;

      resWriteHead.apply(null, args);
    };

    if (options.next && options.next instanceof Function)
    	next.apply(this, arguments);
  }
}
