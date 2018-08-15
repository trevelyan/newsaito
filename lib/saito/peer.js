const saito = require('../saito');
const io           = require('socket.io-client');

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

  //
  // validating publickey
  //
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
 * Connect to another peer in the network
 */
Peer.prototype.connect = function connect() {

  //
  // remote-originated connection
  //
  if (this.isConnected() == true) {

    console.log("CONNECT RUNNING... but from an already-connected socket");

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

  }

  //
  // add events
  //
  this.addSocketEvents();
  this.sendHandshake();

}



/**
 * Sends the initial connection information to the remote peer
 **/
Peer.prototype.sendHandshake = function sendHandshake() {

  var request                           = {};
  request.request                       = "handshake";
  request.data                          = {};
  request.data.host                     = "";
  request.data.port                     = "";
  request.data.publickey                = this.app.wallet.returnPublicKey();
  this.challenge_local                   = (new Date().getTime());
  request.data.challenge                = this.challenge_local;
  request.data.synctype                 = this.peer.synctype;
  request.data.blockchain_send          = 1;
  request.data.lastbid                  = this.app.blockchain.returnLatestBlockId();
  request.data.forkid                   = this.app.blockchain.returnForkId();
  request.data.genesis_bid              = this.app.blockchain.returnGenesisBlockId();
  request.data.sendtransactions         = 1;
  request.data.sendtickets              = 1;
  request.data.sendblocks               = 1;
  request.data.keylist                  = this.app.keychain.returnWatchedPublicKeys();
  request.data.keylist.push               (this.app.wallet.returnPublicKey());

  if (this.app.BROWSER == 0) {
    request.data.host                   = this.app.options.server.host;
    request.data.port                   = this.app.options.server.port;
  }

  console.log("About to send request now!");
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
 * 
 * @params {string} message (i.e. "block")
 * @params {string} data {i.e json object}
 * @params {integer} propagate NOW instead of queueing?
 **/
Peer.prototype.sendRequest = function sendRequest(message, data="") {

  // find out initial state of peer and blockchain
  var userMessage = {};
      userMessage.request  = message;
      userMessage.data     = data;

  // avoid sending unwelcome data
  if (this.sendblocks == 0       && message == "block")         { return; }
  if (this.sendtransactions == 0 && message == "transaction")   { return; }
  if (this.sendtickets == 0      && message == "golden ticket") { return; }

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
 * is our peer connected?
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

	//
	// confirm publickey
	//
        this.challenge_remote  = message.data.challenge;
        var sigmessage      = {};
        sigmessage.request  = "connect-sig";
        sigmessage.data     = {};
        sigmessage.data.sig = this.app.crypt.signMessage("_"+this.challenge_remote, this.app.wallet.returnPrivateKey());
        this.socket.emit('request', JSON.stringify(sigmessage));

	//
	// check blockchain
	//
        let peer_lastbid     = message.data.lastblock;
        let peer_forkid      = message.data.forkid;
        let peer_genesis_bid = message.data.genesis_bid;


/***
        // update blockchain sync data
        if (peer_lastbid > this.app.blockchain.returnLatestBlockId()) {
          peer_self.app.modules.updateBlockchainSync(my_last_bid, my_last_bid);
        } else {
          peer_self.app.modules.updateBlockchainSync(my_last_bid, my_last_bid);
        }



        //
        // update port and host info
        //
        if (message.data.host != "") {
          peer_self.peer.host       = message.data.host;
        }
        if (message.data.port != "") {
          peer_self.peer.port       = message.data.port;
        }

***/

        // 
	// return signature proving publickey
	//
        var sigmessage = {};
        sigmessage.request               = "connect-sig";
        sigmessage.data = {};
        sigmessage.data.sig = this.app.crypt.signMessage("_"+this.challenge_remote, this.app.wallet.returnPrivateKey());
        sigmessage.data.publickey = this.app.wallet.returnPublicKey();
        this.socket.emit('request', JSON.stringify(sigmessage));

      }


      /////////////////
      // connect-sig //
      /////////////////
      if (message.request == "connect-sig") {
        if (message.data == undefined) { return; }
        let sig = message.data.sig;
        let publickey = message.data.publickey;
        if (sig != "") {
          if (peer_self.app.crypt.verifyMessage("_"+this.challenge_local, sig, this.peer.publickey) == 0) {
          } else {
            this.verified = 1;
	    this.peer.publickey = publickey;
          }
        }
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
      }


      ///////////
      // block //
      ///////////
      if (message.request == "block") {
      }


      ////////////////
      // blockchain //
      ////////////////
      if (message.request == "blockchain") {
      }


      /////////////////
      // transaction //
      /////////////////
      if (message.request == "transaction") {
      }


      ///////////////////
      // missing block //
      ///////////////////
      if (message.request == "golden ticket") {
      }


      ///////////////////
      // missing block //
      ///////////////////
      if (message.request == "dns") {
      }

    });

  } catch (err) {
    console.log("ERROR: Peer.addSocketEvents - " + JSON.stringify(err));
  }

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





