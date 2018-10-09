const io    = require('socket.io-client');
const saito = require('../saito');

/**
 * Peer Constructor
 * @param {*} app
 */
function Peer(app, peerjson="") {

  if (!(this instanceof Peer)) {
    return new Peer(app, peerjson);
  }

  this.app     = app || {};


  this.peer                  = {};
  this.peer.host             = "localhost";
  this.peer.port             = "12101";
  this.peer.publickey        = "";
  this.peer.protocol         = "http";
  this.peer.synctype         = "full";          // full = full blocks
                                                 // lite = spv client
  this.peer.keylist          = [];

  //
  // validating publickey
  //
  this.handshake_signature   = "";
  this.handshake_completed   = 0;
  this.handshake_requests_in = 0;
  this.handshake_requests_out= 0;
  this.verified              = 0;
  this.challenge_remote      = null;            // challenge peer creates
  this.challenge_local       = null;            // challenge I create

  //
  // what to send
  //
  this.sendblocks            = 1;
  this.sendtransactions      = 1;
  this.sendtickets           = 1;

  //
  // queue to prevent flooding
  //
  this.message_queue         = [];
  this.message_queue_speed   = 1000;             // sent
  this.message_queue_timer   = null;


  if (this.app.SPVMODE == 1 || this.app.BROWSER == 1) {
    this.peer.synctype       = "lite";
  }

  if (peerjson != "") {
    let peerobj = JSON.parse(peerjson);
    if (peerobj.host != undefined)      { this.peer.host      = peerobj.host; }
    if (peerobj.port != undefined)      { this.peer.port      = peerobj.port; }
    if (peerobj.publickey != undefined) { this.peer.publickey = peerobj.publickey; }
    if (peerobj.protocol != undefined)  { this.peer.protocol  = peerobj.procotol; }
    if (peerobj.synctype != undefined)  { this.peer.synctype  = peerobj.synctype; }
  }

  //
  // manage blockchain sync queue
  //
  this.message_queue_timer = setInterval( () => {
    if (this.message_queue.length > 0) {
      if (this.socket != null) {
        if (this.socket.connected == true) {
          this.socket.emit('request',this.message_queue[0]);
          this.message_queue.splice(0, 1);
        }
      }
    }
  }, this.message_queue_speed);



  return this;

}
module.exports = Peer;



/**
 * Initialize Peer
 */
Peer.prototype.initialize = function initialize() {

}

/**
 * Returns the publickey of the peer
 */
Peer.prototype.returnPublicKey = function returnPublicKey() {
  return this.peer.publickey;
}





/**
 * Connect to another peer in the network
 */
Peer.prototype.connect = function connect() {

  //
  // remote-originated connection
  //
  if (this.isConnected()) {

    console.log("CONNECT RUNNING... but from an already-connected socket");

    //
    // add events
    //
    this.addSocketEvents();

  //
  // re-establish existing connection
  //
  // long-polling should hit here, as isConnected() needs
  // to be false for the network class to attempt a reconnect
  //
  } else if (this.socket != null) {

    this.socket.connect();

  //
  // our connection
  //
  } else {

    console.log("CONNECT RUNNING... no socket, time to open one.");

    //
    // open socket
    //
    var serverAddress = `${this.peer.protocol}://${this.peer.host}:${this.peer.port}`;
    var socket = io(serverAddress);
    this.socket = socket;

    //
    // add events
    //
    this.addSocketEvents();

  }

  //
  // check connection before sending handshake
  //
  if (this.isConnected()) {
    this.sendHandshake();
  }

}



/**
 * Sends the initial connection information to the remote peer
 **/
Peer.prototype.sendHandshake = function sendHandshake(sync_blockchain=1) {

  this.handshake_request_out++;
  if (this.handshake_request_out > 5) {
    this.app.network.cleanupDisconnectedSocket(this);
    return;
  }

  var request                           = {};
  request.request                       = "handshake";
  request.data                          = {};
  request.data.host                     = "";
  request.data.port                     = "";
  request.data.publickey                = this.app.wallet.returnPublicKey();
  this.challenge_local                  = (new Date().getTime());
  request.data.challenge                = this.challenge_local;
  request.data.synctype                 = this.peer.synctype;
  request.data.blockchain_send          = 1;
  request.data.last_bid                 = this.app.blockchain.returnLatestBlockId();
  request.data.forkid                   = this.app.blockchain.returnForkId();
  request.data.genesis_bid              = this.app.blockchain.returnGenesisBlockId();
  request.data.sendtransactions         = 1;
  request.data.sendtickets              = 1;
  request.data.sendblocks               = 1;
  request.data.keylist                  = this.app.keys.returnWatchedPublicKeys();
  request.data.keylist.push               (this.app.wallet.returnPublicKey());

  if (this.app.BROWSER == 0) {
    request.data.host                   = this.app.options.server.host;
    request.data.port                   = this.app.options.server.port;
  }

  this.sendRequest(request.request, request.data);

}




/**
 * Send a message to another Saito peer
 *
 * all messages are interpreted according to
 * the logic defined in the function:
 *
 * addSocketEvents
 *
 * @param {string} message (i.e. "block")
 * @param {string} data {i.e json object}
 **/
Peer.prototype.sendRequest = function sendRequest(message, data="") {

  // avoid sending unwelcome data
  if (this.sendblocks == 0       && message == "block")         { return; }
  if (this.sendtransactions == 0 && message == "transaction")   { return; }
  if (this.sendtickets == 0      && message == "golden ticket") { return; }

  // find out initial state of peer and blockchain
  var userMessage = {};
      userMessage.request  = message;
      userMessage.data     = data;

  //
  // only send the message if we are connected, otherwise
  // cleanup the connection.
  //
  if (this.socket != null) {
    if (this.socket.connected == true) {
      this.socket.emit('request',JSON.stringify(userMessage));
    } else {
      this.message_queue.push(JSON.stringify(userMessage));
      return;
    }
  } else {
    this.app.network.cleanupDisconnectedSocket(this);
    return;
  }
}
/**
 * send a request to a remote peer with a callback
 *
 * TODO
 *
 * add encryption if key available
 *
 * @params {string} message (i.e. "block")
 * @params {string} data {i.e json object}
 * @params {callback}
 *
 * note that propagates instantly because we have a
 * callback to execute and cannot afford to wait
 */
Peer.prototype.sendRequestWithCallback = function sendRequestWithCallback(message, data="", mycallback) {

  // avoid sending unwelcome data
  if (this.sendblocks == 0       && message == "block")         { return; }
  if (this.sendtransactions == 0 && message == "transaction")   { return; }
  if (this.sendtickets == 0      && message == "golden ticket") { return; }

  // find out initial state of peer and blockchain
  var userMessage = {};
      userMessage.request  = message;
      userMessage.data     = data;

  //
  // only send the message if we are connected, otherwise
  // cleanup the connection.
  //
  if (this.socket != null) {
    if (this.socket.connected == true) {
      this.socket.emit('request',JSON.stringify(userMessage), mycallback);
      return;
    }
  }

  //
  // this only executes if we are not connected
  // to the peer above
  //
  tmperr = {}; tmperr.err = "peer not connected";
  mycallback(tmperr);

}







/**
 * Is our peer connected?
 * @returns {boolean} isConnected
 */
Peer.prototype.isConnected = function isConnected() {
  if (this.socket != null) {
    if (this.socket.connected == true) {
      return true;
    }
  }
  return false;
}



/**
 * Allow our socket to send and receive messages
 *
 * After we connect to a remote node, we add events to the
 * socket. This function creates those events, which fire
 * on connections / disconnection and whenever we receive
 * data from the remote node.
 *
 * This is the heart of the peer class. All of the important
 * behavior is defined in this function.
 */
Peer.prototype.addSocketEvents = function addSocketEvents() {

  //
  // we wrap the entire function in a try / catch block
  // so that any problems triggered by remote servers 
  // will not crash our server.
  //
  try {

    /////////////
    // connect //
    /////////////
    this.socket.on('connect', () => {
      console.log("client connect");
    });

    ////////////////
    // disconnect //
    ////////////////
    this.socket.on('disconnect',() => {
      console.log("client disconnect");
    });

    ///////////
    // event //
    ///////////
    this.socket.on('event', () => {});


    //////////////////
    // other events //
    //////////////////
    this.socket.on('request', (data, mycallback=null) => {

      let response = {}
      let message = JSON.parse(data.toString());


      /////////////////////
      // module callback //
      /////////////////////
      this.app.modules.handlePeerRequest(message, this, mycallback);


      ///////////////
      // handshake //
      ///////////////
      if (message.request == "handshake") {

        //
        // peer preferences
        //
        if (message.data.sendblocks < this.sendblocks) { this.sendblocks = message.data.sendblocks; }
        if (message.data.sendtransactions < this.sendtransactions) { this.sendtransactions = message.data.sendtransactions; }
        if (message.data.sendtickets < this.sendtickets) { this.sendtickets = message.data.sendtickets; }

        this.peer.publickey = message.data.publickey;
        this.peer.keylist   = message.data.keylist;
        if (message.data.synctype == "lite") { this.peer.synctype = "lite"; }
        if (message.data.host != "") { this.peer.host = message.data.host; }
        if (message.data.port != "") { this.peer.port = message.data.port; }

        //
        // check blockchain
        //
        let peer_last_bid    = message.data.last_bid;
        let peer_forkid      = message.data.forkid;
        let peer_genesis_bid = message.data.genesis_bid;

        //
        // NOTE -- when fetching blocks from peers, you have to update
        // the lowest_acceptable_ts if you do not already have something
        // acceptable in your options / blockchain.
        //


        // update blockchain sync data
        let my_last_bid = this.app.blockchain.returnLatestBlockId();
        if (peer_last_bid > my_last_bid) {
          this.app.options.blockchain.target_bid = peer_last_bid;
          this.app.modules.updateBlockchainSync(my_last_bid, peer_last_bid);
        } else {
          this.app.modules.updateBlockchainSync(my_last_bid, my_last_bid);
        }


        //
        // figure out our last common block
        //
        let last_shared_bid = this.app.blockchain.returnLastSharedBlockId(peer_forkid, peer_last_bid);

        //
	// send blockchain info
	//
	if (this.app.blockchain.returnLatestBlockId() > last_shared_bid) {
	  this.sendBlockchain(last_shared_bid);
	}

	//
	// we already received a signature confirming
	// their publickey, but had not received their
	// initial handshake. So now that we have 
	// the handshake, lets validate them.
	//
	if (this.handshake_signature != "") {
          if (this.app.crypto.verifyMessage("_"+this.challenge_local, this.handshake_signature, this.peer.publickey) == 0) {
            var sigmessage      = {};
            sigmessage.request  = "connect-deny";
            sigmessage.data     = {};
            this.socket.emit('request', JSON.stringify(sigmessage));
            this.app.network.cleanupDisconnectedSocket(this);
          } else {
            this.verified = 1;
          }
	}

	//
	// complete handshake
	//
	this.handshake_completed = 1;

        //
        // confirm publickey
        //
        this.challenge_remote  = message.data.challenge;
        var sigmessage      = {};
        sigmessage.request  = "connect-sig";
        sigmessage.data     = {};
        sigmessage.data.sig = this.app.crypto.signMessage("_"+this.challenge_remote, this.app.wallet.returnPrivateKey());
        this.socket.emit('request', JSON.stringify(sigmessage));

      }



      /////////////////
      // connect-sig //
      /////////////////
      if (message.request == "connect-sig") {
        if (message.data == undefined) { return; }
	
	//
	// we have the sig-reply but no handshake
	// which means a connection issue with
	// websockets firing randomly
	//
	// at this point we should be connected
	// so we send another handshake request
	// and save this signature so we can 
	// process it on receipt of the handshake
	//
        let sig = message.data.sig;

	if (this.handshake_completed == 0) { 

	  this.handshake_signature = sig;
	  //
	  // request handshake
	  //
          var sigmessage      = {};
          sigmessage.request  = "handshake request";
          sigmessage.data     = {};
          this.socket.emit('request', JSON.stringify(sigmessage));
	  return;

	}
        if (sig != "") {
          if (this.app.crypto.verifyMessage("_"+this.challenge_local, sig, this.peer.publickey) == 0) {
          } else {
            this.verified = 1;
          }
        }
      }


      ///////////////////////
      // handshake request //
      ///////////////////////
      if (message.request == "handshake request") {
	this.handshake_requests_out++;
	if (this.handshake_requests > 5) {
          this.socket = null;
	  this.app.network.cleanupDisconnectedSocket(this);
	}
        this.sendHandshake();
        return;
      }


      //////////////////
      // connect-deny //
      //////////////////
      if (message.request == "connect-deny") {
        this.socket = null;
        this.app.network.cleanupDisconnectedSocket(this);
        return;
      }


      ///////////////////
      // missing block //
      ///////////////////
      if (message.request == "missing block") {

        let t = JSON.parse(message.data);
        let missing_hash = t.hash;
        let last_hash = t.last_hash;

	let missing_bid = this.app.blockchain.block_hash_hmap[missing_hash];
	let last_bid = this.app.blockchain.block_hash_hmap[last_hash];

	if (last_hash == "") {
          if (missing_bid > 0) {
  	    var data = { bhash : missing_hash , bid : missing_bid };
            this.sendRequest("block", data);
          }
          return;
        }

        if (last_bid > 0) {

          // if we need to send more, send whole blockchain
          if (missing_bid > last_bid+1) {
            this.sendBlockchain(last_bid+1);
          } else {
            var data = { bhash : missing_hash , bid : missing_bid };
            this.sendRequest("block", data);
          }

          if (mycallback != null) { mycallback(); }

        }

      }



      ///////////
      // block //
      ///////////
      if (message.request == "block") {
        if (message.data == null) { return; }
        if (message.data.bhash == null) { return; }
        if (this.app.blockchain.isHashIndexed(message.data.bhash) != 1) { this.app.mempool.fetchBlock(this, message.data.bhash); }
        return;
      }


      ////////////////
      // blockchain //
      ////////////////
      if (message.request == "blockchain") {

	let blocks = message.data;
	let prevhash = blocks.start;

        for (let i = 0; i < blocks.prehash.length; i++) {
	  let bid   = blocks.bid[i];
	  let hash  = this.app.crypto.hash(blocks.prehash[i] + prevhash);
	  let ts    = blocks.ts[i];
	  let txsno = blocks.txs[i];
          if (this.app.blockchain.isHashIndexed(hash) != 1) { 
	    if (txsno == 0) {
	      if (this.app.BROWSER == 1) {
	        this.app.blockchain.addHashToBlockchain(hash, ts, bid, prevhash);
	      } else {
	        this.app.mempool.fetchBlock(this, hash); 
	      }
            } else {
	      this.app.mempool.fetchBlock(this, hash); 
	    }
          }
          prevhash  = hash;
        } 

      }


      /////////////////
      // transaction //
      /////////////////
      if (message.request == "transaction") {
        var tx = new saito.transaction(message.data);
        if (tx == null) { return; }
        if (!tx.is_valid) { return; }
        this.app.mempool.addTransaction(tx);
        if (mycallback != null) { 
	  mycallback();
        }
        return;
      }


      ///////////////////
      // golden ticket //
      ///////////////////
      if (message.request == "golden ticket") {
        var tx = new saito.transaction(message.data);
        if (tx == null) { return; }
        if (tx.is_valid == 0) { return; }
        this.app.network.propagateGoldenTicket(tx);
        this.app.mempool.importTransaction(message.data);
        return;
      }


      /////////
      // dns //
      /////////
      if (message.request == "dns") {
      }

    });

  } catch (err) {
    console.log("ERROR: Peer.addSocketEvents - " + JSON.stringify(err));
  }

}




Peer.prototype.sendBlockchain = function sendBlockchain(start_bid) {

  if (start_bid == 0) {
    start_bid = this.app.blockchain.returnLatestBlockId() - 10;
    if (start_bid < 0) { start_bid = 0; }
  }

  let message               = {};
      message.request       = "blockchain";
      message.data          = {};
      message.data.start    = null;
      message.data.prehash  = [];
      message.data.bid	    = [];
      message.data.ts	    = [];
      message.data.txs	    = [];

  let starting_blockchain_index = 0;
  let start_idx = 0;

  for (let i = this.app.blockchain.index.bid.length; i >= 0; i--) {
    if (this.app.blockchain.index.bid[i] < start_bid) {
      i = -1;
    } else {
      start_idx = i;
    }
  }

  let first = 0;
  for (let i = start_idx; i < this.app.blockchain.index.hash.length; i++) {
    if (this.app.blockchain.index.lc[i] == 1) {
      if (message.data.start == null) {
        message.data.start = this.app.blockchain.blocks[i].block.prevhash;
      }
      message.data.prehash.push(this.app.blockchain.blocks[i].prehash);
      message.data.bid.push(this.app.blockchain.index.bid[i]);
      message.data.ts.push(this.app.blockchain.index.ts[i]);
      //
      // number of txs for me
      //
      if (this.app.blockchain.blocks[i].hasKeylistTransactionsInBloomFilter(this.peer.keylist)) {
        message.data.txs.push(1);
      } else {
        message.data.txs.push(0);
      }
    }
  }
  
console.log("sending message..." + JSON.stringify(message));
  this.socket.emit('request', JSON.stringify(message));
  return;

}






///////////////////////
// inTransactionPath //
///////////////////////
//
// is this peer is the transaction path of this transaction?
//
// @params {saito.transaction} transaction to check
//
/**
 * Checks if a peer is in the transaction path of the provided transaction
 **/
Peer.prototype.inTransactionPath = function inTransactionPath(tx) {
  if (tx == null) { return 0; }
  if (tx.isFrom(this.peer.publickey)) { return 1; }
  for (let zzz = 0; zzz < tx.transaction.path.length; zzz++) {
    if (tx.transaction.path[zzz].from == this.peer.publickey) {
      return 1;
    }
  }
  return 0;
}






