const saito        = require('../saito');
const net          = require('net');
const http         = require('http');
const fs           = require('fs');
const path         = require('path');


/**
 * Constructor
 */
function Server(app) {

  if (!(this instanceof Server)) {
    return new Server(app);
  }

  this.app                        = app || {};

  this.blocks_dir                 = path.join(__dirname, '../data/blocks/');
  this.server                     = {};
  this.server.host                = "";
  this.server.port                = 0;
  this.server.publickey           = "";
  this.server.protocol            = "";

  this.server.endpoint            = {};
  this.server.endpoint.host       = "";
  this.server.endpoint.port       = 0;
  this.server.endpoint.protocol   = "";

  this.webserver                  = null;
  this.io                         = null;

  return this;

}
module.exports = Server;



/**
 * Initialize our Server
 *
 * This creates the server that will feed out our HTML
 * files. It then passes control to any installed modules
 * which can affix their own content to the web-server.
 */
Server.prototype.initialize = function initialize() {

  if (this.app.BROWSER == 1) { return; }

  //
  // update publickey
  //
  this.server.publickey = this.app.wallet.returnPublicKey();

  //
  // update server information from options file
  //
  if (this.app.options.server != null) {
    this.server.host = this.app.options.server.host;
    this.server.port = this.app.options.server.port;
    this.server.protocol = this.app.options.server.protocol;
  }

  //
  // sanity check 
  //
  if (this.server.host == "" || this.server.port == 0) {
    console.log("Not starting local server as no hostname / port in options file");
    return;
  }

  //
  // init endpoint
  //
  if (this.app.options.server.endpoint != null) {
    this.server.endpoint.port = this.app.options.server.endpoint.port;
    this.server.endpoint.host = this.app.options.server.endpoint.host;
    this.server.endpoint.protocol = this.app.options.server.endpoint.protocol;
    this.server.endpoint.publickey = this.app.options.server.publickey;
  } else {
    var {host, port, protocol, publickey} = this.server
    this.server.endpoint = {host, port, protocol, publickey};
    this.app.options.server.endpoint = {host, port, protocol, publickey};
    this.app.storage.saveOptions();
  }

  //
  // save options
  //
  this.app.options.server = this.server;
  this.app.storage.saveOptions();


  //
  // now we setup our server
  //
  const app 	      = require('express')();
  const fileUpload  = require('express-fileupload');
  const webserver   = require('http').Server(app);
  const io 	        = require('socket.io')(webserver);
  const bodyParser  = require('body-parser');

  
  //
  // enable cross origin polling for socket.io
  //
  io.origins('*:*');


  //
  // plugins and modules
  //
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(fileUpload());


  ////////////
  // blocks //
  ////////////
  app.get('/blocks/:blockhash', function (req, res) {
  });


  /////////////////////////
  // general web content //
  /////////////////////////
  app.all('/', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
  });
  app.get('/options', function (req, res) {
    server_self.app.storage.saveClientOptions();
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.setHeader("expires","-1");
    res.setHeader("pragma","no-cache");
    res.sendFile(__dirname + '/web/client.options');
    return;
  });
  app.get('/:filename', function (req, res) {
    var filename = req.params.imagefile;
    if (filename.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + '/web/' + filename);
    return;
  });
  app.get('/browser.js', function (req, res) {

    //
    // non-gzipped, non-cached
    //res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    //res.setHeader("expires","-1");
    //res.setHeader("pragma","no-cache");
    //
    //  non-gzipped, cached
    res.setHeader("Cache-Control", "public");
    res.setHeader("expires","72000");
    res.sendFile(__dirname + '/web/browser.js');
    return;

  });
  app.get('/img/:imagefile', function (req, res) {
    var filename = '/web/img/'+req.params.imagefile;
    if (filename.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + filename);
    return;
  });
  app.get('/img/graphs/:imagefile', function (req, res) {
    var filename = '/web/img/graphs/'+req.params.imagefile;
    if (filename.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + filename);
    return;
  });
  app.get('/docs/:basefile', function (req, res) {
    var filename = '/web/docs/'+req.params.basefile;
    if (filename.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + filename);
    return;
  });
  app.get('/jquery/:basefile', function (req, res) {
    var filename = '/web/lib/jquery/'+req.params.basefile;
    if (filename.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + filename);
    return;
  });
  app.get('/qrcode/:basefile', function (req, res) {
    var filename = '/web/lib/qrcode/'+req.params.basefile;
    if (filename.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + filename);
    return;
  });
  app.get('/fancybox/:filename', function (req, res) {
    var filename = '/web/lib/fancybox/'+req.params.filename;
    if (filename.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + filename);
    return;
  });
  app.get('/font-awesome/css/:filename', function (req, res) {
    var filename = '/web/lib/font-awesome/css/'+req.params.filename;
    if (filename.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + filename);
    return;
  });
  app.get('/font-awesome/fonts/:filename', function (req, res) {
    var filename = '/web/lib/font-awesome/fonts/'+req.params.filename;
    if (filename.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + filename);
    return;
  });
  app.get('/pace/:filename', function (req, res) {
      var filename = '/web/lib/pace/'+req.params.filename;
      if (filename.indexOf("\/") != false) { return; }
      res.sendFile(__dirname + filename);
      return;
    });


  /////////////////
  // module data //
  /////////////////
  //
  // module support is not yet active
  // when we reactivate the modules
  // we should re-enable this callback
  //
  //this.app.modules.webServer(app);

  webserver.listen(this.server.port);

  this.webServer = webserver;

  // update network
  io.on('connection', function (socket) {
    server_self.app.network.addPeerWithSocket(socket);
  });

}

Server.prototype.close = function close() {
  this.webServer.close();
}

