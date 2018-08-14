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

  this.challenge_remote      = null;            // challenge peer creates
  this.challenge_local       = null;            // challenge I create


  if (this.app.SPVMODE == 1 || this.app.BROWSER == 1) {
    this.peer.synctype       = "lite";
  }

  if (peerjson != "") {
    let peerobj = JSON.parse(peerjson);
    if (peerobj.host != undefined)      { this.peer.host = peerobj.host; }
    if (peerobj.port != undefined)      { this.peer.port = peerobj.port; }
    if (peerobj.publickey != undefined) { this.peer.publickey = peerobj.publickey; }
    if (peerobj.protocol != undefined)  { this.peer.protocol = peerobj.procotol; }
    if (peerobj.synctype != undefined)  { this.peer.synctype = peerobj.synctype; }
  }


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

  this.addSocketEvents();

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
  // send synopsis of current info
  //
  var response                           = {};
  response.request                       = "handshake";
  response.data                          = {};
  response.data.publickey                = this.app.wallet.returnPublicKey();
  this.challenge_local                   = (new Date().getTime());
  response.data.challenge                = this.challenge_local;
  response.data.synctype                 = this.peer.synctype;
  //response.data.reindexing               = this.app.storage.currently_reindexing;
  //response.data.current_block_id         = this.app.blockchain.returnLatestBlockId();
  //response.data.current_fork_id          = this.app.blockchain.returnForkId();
  //response.data.current_genesis_block_id = this.app.blockchain.returnGenesisBlockId();
  if (this.app.BROWSER == 0) {
    response.data.host                   = this.app.options.server.host;
    response.data.port                   = this.app.options.server.port;
  }

  this.sendRequest(response.request, response.data);

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
      this.app.network.cleanupDisconnectedSocket(this);
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

console.log("adding socket events...");

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


      console.log(data.toString());


      /////////////////////
      // module callback //
      /////////////////////
      //this.app.modules.handlePeerRequest(message, peer_self, mycallback);


      ///////////////
      // handshake //
      ///////////////
      if (message.request == "handshake") {

	// this is our initial connection both ways
        console.log("HANDSHAKE!");

      }

    });

  } catch (err) {
    console.log("C: " + JSON.stringify(err));
    //console.log("ERROR: Peer.addSocketEvents - " + JSON.stringify(err));
  }

}






