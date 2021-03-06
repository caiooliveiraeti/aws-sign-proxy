#!/usr/bin/env node

var AWS = require('aws-sdk');
var http = require('http');
var httpProxy = require('http-proxy');
var express = require('express');
var bodyParser = require('body-parser');
var stream = require('stream');
var figlet = require('figlet');
var basicAuth = require('basic-auth-connect');
var compress = require('compression');

var yargs = require('yargs')
    .usage('usage: $0 [options] <serice-endpoint>')
    .option('b', {
        alias: 'bind-address',
        default: process.env.BIND_ADDRESS || '127.0.0.1',
        demand: false,
        describe: 'the ip address to bind to',
        type: 'string'
    })
    .option('p', {
        alias: 'port',
        default: process.env.PORT || 9200,
        demand: false,
        describe: 'the port to bind to',
        type: 'number'
    })
    .option('r', {
        alias: 'region',
        default: process.env.REGION,
        demand: false,
        describe: 'the region of the service',
        type: 'string'
    })
    .option('u', {
      alias: 'user',
      default: process.env.USER,
      demand: false,
      describe: 'the username to access the proxy'
    })
    .option('a', {
      alias: 'password',
      default: process.env.PASSWORD,
      demand: false,
      describe: 'the password to access the proxy'
    })
    .option('s', {
      alias: 'service',
      default: false,
      demand: false,
      describe: 'service name'
    })
    .help()
    .version()
    .strict();
var argv = yargs.argv;

var ENDPOINT = process.env.ENDPOINT || argv._[0];

if (!ENDPOINT) {
    yargs.showHelp();
    process.exit(1);
}

// Try to infer the region if it is not provided as an argument.
var REGION = argv.r;
if (!REGION) {
    var m = ENDPOINT.match(/([^.]+)\.([^.]+)\.amazonaws\.com\.?$/);
    if (m) {
        REGION = m[1];
    } else {
        console.error('region cannot be parsed from endpoint address, either the endpoint must end ' +
                      'in .<region>.<service>.amazonaws.com or --region should be provided as an argument');
        yargs.showHelp();
        process.exit(1);
    }
}

// Try to infer the servicename if it is not provided as an argument.
var SERVICE = argv.s;
if (!REGION) {
    var m = ENDPOINT.match(/([^.]+)\.([^.]+)\.amazonaws\.com\.?$/);
    if (m) {
        SERVICE = m[2];
    } else {
        console.error('region cannot be parsed from endpoint address, either the endpoint must end ' +
                      'in .<region>.<service>.amazonaws.com or --region should be provided as an argument');
        yargs.showHelp();
        process.exit(1);
    }
}

var TARGET = process.env.ENDPOINT || argv._[0];
if (!TARGET.match(/^https?:\/\//)) {
    TARGET = 'https://' + TARGET;
}

var BIND_ADDRESS = argv.b;
var PORT = argv.p;

var credentials;
var chain = new AWS.CredentialProviderChain();
chain.resolve(function (err, resolved) {
    if (err) throw err;
    else credentials = resolved;
});

function getCredentials(req, res, next) {
    return credentials.get(function (err) {
        if (err) return next(err);
        else return next();
    });
}
var proxy = httpProxy.createProxyServer({
    target: TARGET,
    changeOrigin: true,
    secure: true
});

var app = express();
app.use(compress());
if (argv.u && argv.a) {
  app.use(basicAuth(argv.u, argv.a));
}
app.use(bodyParser.raw({type: function() { return true; }}));
app.use(getCredentials);
app.use(function (req, res) {
    var bufferStream;
    if (Buffer.isBuffer(req.body)) {
        var bufferStream = new stream.PassThrough();
        bufferStream.end(req.body);
    }
    proxy.web(req, res, {buffer: bufferStream});
});

proxy.on('proxyReq', function (proxyReq, req) {
    var endpoint = new AWS.Endpoint(ENDPOINT);
    var request = new AWS.HttpRequest(endpoint);
    request.method = proxyReq.method;
    request.path = proxyReq.path;
    request.region = REGION;
    if (Buffer.isBuffer(req.body)) request.body = req.body;
    if (!request.headers) request.headers = {};
    request.headers['presigned-expires'] = false;
    request.headers['Host'] = ENDPOINT;

    var signer = new AWS.Signers.V4(request, SERVICE);
    signer.addAuthorization(credentials, new Date());

    proxyReq.setHeader('Host', request.headers['Host']);
    proxyReq.setHeader('X-Amz-Date', request.headers['X-Amz-Date']);
    proxyReq.setHeader('Authorization', request.headers['Authorization']);
    if (request.headers['x-amz-security-token']) proxyReq.setHeader('x-amz-security-token', request.headers['x-amz-security-token']);
});

proxy.on('proxyRes', function (proxyReq, req, res) {
    if (req.url.match(/\.(css|js|img|font)/)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
    }
});

http.createServer(app).listen(PORT, BIND_ADDRESS);

console.log('AWS Sign Proxy available at http://' + BIND_ADDRESS + ':' + PORT);
