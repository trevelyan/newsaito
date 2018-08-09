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

