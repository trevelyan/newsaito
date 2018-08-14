const saito = require('../saito');
const io           = require('socket.io-client');

/**
 * Peer Constructor
 * @param {*} app
 */
function Peer(app) {

  if (!(this instanceof Peer)) {
    return new Peer(app);
  }

  this.app     = app || {};


  this.peer                  = {};
  this.peer.host             = "localhost";
  this.peer.port             = "12101";
  this.peer.publickey        = "";
  this.peer.protocol         = "http";
  this.peer.synctype         = "full";          // full = full blocks
 					        // lite = spv client

  if (this.app.SPVMODE == 1 || this.app.BROWSER == 1) {
    this.peer.synctype       = "lite";
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
 * Add a Peer to our Network
 */
Peer.prototype.addPeer = function addPeer(peerjson) {

  let peerobj = JSON.parse(peerjson);

  if (peerobj.host != undefined) { this.peer.host = peerobj.host; }
  if (peerobj.port != undefined) { this.peer.port = peerobj.port; }
  if (peerobj.publickey != undefined) { this.peer.publickey = peerobj.publickey; }
  if (peerobj.protocol != undefined) { this.peer.protocol = peerobj.procotol; }
  if (peerobj.synctype != undefined) { this.peer.synctype = peerobj.synctype; }

  this.connect();

}



/**
 * Connect to another peer in the network
 */
Peer.prototype.connect = function connect() {

  // remote-originated connection
  if (this.isConnected() == true) {

    console.log("CONNECT RUNNING... but from an already-connected socket");

  // our connection
  } else {

    console.log("CONNECT RUNNING... no socket, time to open one.");

    //
    // open socket
    //
    var serverAddress = `${this.peer.protocol}://${this.peer.host}:${this.peer.port}`;
    var socket = io(serverAddress);
    this.socket = socket;

  }

  this.addSocketEvents();

}





/**
 * isConnected
 *
 * Check to see if our peer is connected or disconnected
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
    this.socket.on('connect', function(){
      this.initializing = 0;
      console.log("client connect");
      if (peer_self.contact == 0) {
        if (peer_self.disconnected == 1) {
          peer_self.socket.emit('request',JSON.stringify(peer_self.returnConnectMessage()));
        }
      }
    });


  } catch (err) {
    console.log("ERROR: Peer.addSocketEvents - " + JSON.stringify(err));
  }

}

