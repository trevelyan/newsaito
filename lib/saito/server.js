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
  const express     = require('express');
  const app 	    = express();
  const fileUpload  = require('express-fileupload');
  const webserver   = require('http').Server(app);
  const io          = require('socket.io')(webserver);
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


  app.all('/', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
  });

  ////////////
  // blocks //
  ////////////
  app.get('/blocks/:bhash', (req, res) => {

    let bhash = req.params.bhash;
    if (bhash == null) { return; }

    try {

      //
      // serve from mempool if exists
      //
      for (let i = 0; i < this.app.mempool.blocks.length; i++) {
        let blk = this.app.mempool.blocks[i];
        if (blk.returnHash() == bhash) {
          let blkjson = JSON.stringify(blk.block).toString('utf8');
          if (blk.block.id == 1 || blk.block.transactions.length > 0) {
            res.write(blkjson);
            res.end();
            return;
          }
	  i = this.app.mempool.blocks.length;
        }
      }

      // return file requested
      //
      // TODO - this uses a callback, is it possible to change over 
      // to using a promise, or are we unable to do this because we
      // would need to change the Express server function to operate
      // asynchronously.
      //
      this.app.storage.returnBlockFilenameByHash(bhash, (filename) => {
        if (filename != null) {
          let blkfilename = this.blocks_dir + filename;
          res.sendFile(blkfilename);
          return;
        }
      });

    } catch (err) {
      console.log("FAILED SERVER REQUEST: could not find block: " + bhash);
    }
    return;
  });


  /////////////////
  // lite-blocks //
  /////////////////
  app.get('/lite-blocks/:bhash/:pkey', (req, res) => {

    let bhash = req.params.bhash;
    let pkey  = req.params.pkey;
    if (bhash == null || pkey == null) { return; }

    let peer = this.app.network.returnPeerByPublicKey(pkey);
    let keylist = [];


    if (peer == null) {
      keylist.push(pkey);
    } else {
      keylist = peer.peer.keylist;
    }

    try {

      //
      // serve from mempool if exists
      //
      for (let i = 0; i < this.app.mempool.blocks.length; i++) {
        let blk = this.app.mempool.blocks[i];
        if (blk.returnHash() == bhash) {

          for (let i = 0; i < keylist.length && keylist[i] != undefined && blk != null; i++) {
            if (blk.hasTransactionsInBloomFilter(keylist[i]) == true) {

              let tempblk = JSON.parse(JSON.stringify(blk.block));

              for (let i = 0; i < blk.transactions.length; i++) {
                let add_transaction = 0;
                for (let ii = 0; ii < blk.transactions[i].transaction.from.length && add_transaction == 0; ii++) {
                  if (keylist.includes(blk.transactions[i].transaction.from[ii].add)) { add_transaction = 1; }
                }
                for (let ii = 0; ii < blk.transactions[i].transaction.to.length && add_transaction == 0; ii++) {
                  if (keylist.includes(blk.transactions[i].transaction.to[ii].add)) { add_transaction = 1; }
                }
                if (add_transaction == 1) {
                  let x = {"transaction" : blk.transactions[i].transaction};
                  tempblk.txsjson.push(JSON.stringify(x));
                }
              }

              let blkjson = JSON.stringify(tempblk).toString('utf8');
              res.write(blkjson);
              res.end();
              return;

	    } else {

              let tempblk = JSON.parse(JSON.stringify(blk.block));
              tempblk.txsjson = [];
	      let blkjson = JSON.stringify(tempblk).toString('utf8');
              res.write(blkjson);
              res.end();
              return;

            }
          }

          return;
        }
      }


      //
      // return file requested
      //
      // TODO - this uses a callback, is it possible to change over 
      // to using a promise, or are we unable to do this because we
      // would need to change the Express server function to operate
      // asynchronously.
      //
      this.app.blockchain.returnBlockByHashFullOnlyIfContainsTransactionsWithCallback(bhash, keylist, (blk) => {

	if (blk == null) {
	  res.write("{}");
	  res.end();
          return;
 	}

	let tempblk = JSON.parse(JSON.stringify(blk.block));

        for (let i = 0; i < blk.transactions.length; i++) {
	  let add_transaction = 0;
          for (let ii = 0; ii < blk.transactions[i].transaction.from.length && add_transaction == 0; ii++) {
	    if (keylist.includes(blk.transactions[i].transaction.from[ii].add)) { add_transaction = 1; }
          }
          for (let ii = 0; ii < blk.transactions[i].transaction.to.length && add_transaction == 0; ii++) {
	    if (keylist.includes(blk.transactions[i].transaction.to[ii].add)) { add_transaction = 1; }
          }
          if (add_transaction == 1) {
	    let x = {"transaction" : blk.transactions[i].transaction};
	    tempblk.txsjson.push(JSON.stringify(x));
          }
        }

        let blkjson = JSON.stringify(tempblk).toString('utf8');
        res.write(blkjson);
        res.end();
        return;

      });
    } catch (err) {
      console.log("FAILED SERVER REQUEST: could not find block: " + bhash);
    }
    return;
  });


  /////////////////////////
  // general web content //
  /////////////////////////
  app.get('/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  app.get('/options', (req, res) => {
    this.app.storage.saveClientOptions();
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.setHeader("expires","-1");
    res.setHeader("pragma","no-cache");
    res.sendFile(__dirname + '/web/client.options');
    return;
  });
  app.get('/browser.js', function (req, res) {

    //
    // may be useful in the future, if we gzip
    // files before releasing for production
    //
    // gzipped, cached -- if you enable cached
    // and gzipped, be sure to manually edit the
    // content-length to reflect the size of the
    // file
    //
    //res.setHeader("Cache-Control", "public");
    //res.setHeader("Content-Encoding", "gzip");
    //res.setHeader("Content-Length", "368432");
    //res.sendFile(__dirname + '/web/browser.js.gz');
    //

    // non-gzipped, non-cached
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.setHeader("expires","-1");
    res.setHeader("pragma","no-cache");
    res.sendFile(__dirname + '/web/browser.js');
    //
    //  non-gzipped, cached
    //
    //res.setHeader("Cache-Control", "public");
    //res.setHeader("expires","72000");
    //res.sendFile(__dirname + '/web/browser.js');
    return;
  });
  app.use(express.static(path.join(__dirname, 'web')));


  /////////////////
  // module data //
  /////////////////
  //
  // module support is not yet active
  // when we reactivate the modules
  // we should re-enable this callback
  //
  this.app.modules.webServer(app);

  webserver.listen(this.server.port);
  this.webserver = webserver;

  // incoming sockets
  io.on('connection', (socket) => { this.app.network.addRemotePeer(socket); });

}

Server.prototype.close = function close() {
  this.webserver.close();
}

