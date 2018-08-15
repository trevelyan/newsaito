const saito = require('../saito');


/**
 * Network Constructor
 * @param {*} app
 */
function Network(app) {

  if (!(this instanceof Network)) {
    return new Network(app);
  }


  this.app             = app || {};


  this.peers                    = [];
  this.peer_monitor_timer       = null;
  this.peer_monitor_timer_speed = 10000;  // check socket status every 10 seconds
  this.peers_connected          = 0;
  this.peers_connected_limit    = 20; // max peers

  return this;

}
module.exports = Network;



/**
 * Initialize Network 
 *
 * Check our options file to see which peers we should 
 * connect to and start the connection process. Note that
 * connections are not instant, so other parts of the 
 * application may not be able to use the network right
 * when they are initializing
 * 
 * Once peers are setup, we start a timer that monitors
 * the quality of the connections and handles socket
 * disconnections.
 */
Network.prototype.initialize = function initialize() {

console.log("initializing network....");

  // connect to peers
  if (this.app.options.peers != null) {
    for (let i = 0; i < this.app.options.peers.length; i++) {
      // add the peer
      console.log("Initialize our Network and Connect to Peers");
console.log("connecting to: " + JSON.stringify(this.app.options.peers[i]));
      this.addPeer(JSON.stringify(this.app.options.peers[i]));
    }
  }

  // and monitor them
  this.peer_monitor_timer = setInterval(() => {
    for (let i = this.peers.length-1; i >= 0; i--) {
      if (this.peers[i].isConnected() == 0) {
	console.log("We should cleanup this disconnected socket");
        this.cleanupDisconnectedSocket(this.peers[i]);
      }
    }
  }, this.peer_monitor_timer_speed);

}







/**
 * Add a remote peer to our network connection class
 *
 * We do a quick sanity check to make sure we are not connecting
 * to ourselves before we connect to a peer node.
 *
 * @params {string} peer IP address
 * @params {integer} peer port
 * @params {boolean} send blocks to this peer
 * @params {boolean} send transactions to this peer
 * @params {boolean} send golden ticket solutions to this peer
 *
 **/
Network.prototype.addPeer = function addPeer(peerjson, sendblks=1, sendtx=1, sendgtix=1) {

  let peerhost = "";
  let peerport = "";

  let peerobj = JSON.stringify(peerjson);

  if (peerobj.host != undefined) { peerhost = peerobj.host; }
  if (peerobj.port != undefined) { peerport = peerobj.port; }


  //
  // no duplicate connections
  //
  for (let i = 0; i < this.peers.length; i++) {
    if (this.peers[i].peer.host == peerhost && this.peers[i].peer.port == peerport) {
      if (sendblks == 1) { this.peers[i].sendblocks = 1;       }
      if (sendtx   == 1) { this.peers[i].sendtransactions = 1; }
      if (sendgtix == 1) { this.peers[i].sendtickets = 1;      }
      return;
    }
  }

  //
  // do not connect to ourselves
  //
  if (this.app.options.server != null) {
    if (this.app.options.server.host == peerhost && this.app.options.server.port == peerport) {
      console.log("Not adding "+this.app.options.server.host+" as peer node as it is our server.");
      return;
    }
  }

  //
  // create peer and add it
  //
  let peer = new saito.peer(this.app, peerjson);
  peer.connect();
  this.peers.push(peer);
  this.peers_connected++;

}




/**
 * Foreign-originated connections hit our network class here.
 * If we are originating the connection ourselves, we want to
 * use the function:
 *
 * @params {socket.io-client socket} peer socket
 *
 **/
Network.prototype.addRemotePeer = function addRemotePeer(socket) {

  // deny excessive connections
  if (this.peers_connected >= this.peers_connected_limit) {
    var message = {};
        message.request               = "connect-deny";
    socket.emit('request',JSON.stringify(message));
    socket.disconnect();
    return;
  }

  // sanity check
  for (let i = 0; i < this.peers.length; i++) {
    if (this.peers[i].socket_id == socket.id) {
      console.log("error adding socket: already in pool");
      return;
    }
  }

  //
  // add peer
  //
  let peer = new saito.peer(this.app);
  peer.socket = socket;
  peer.connect();
  this.peers.push(peer);  
  this.peers_connected++;

}






/**
 * Is Private Network
 *
 * Returns 1 if we are the only node on this network.
 *
 * This is used by the mempool class when producing blocks
 * as we do not want to flood a public network with blocks
 * created when the burn value hits 0.0 if we are on a public
 * network -- it may just be that our connection dropped.
 */
Network.prototype.isPrivateNetwork = function isPrivateNetwork() {

  // we calculate the number of peers to which we ARE connected
  // and/or the number of peers we have specified that we want
  // to be connected with in order to determine if we are on a
  // private network.

  // private networks are useful for testing functionality, as
  // we will not produce blocks without transactions on a public
  // network.

  return true;

}





/**
 * Remove disconnected peers from our list of peers
 *
 * @params {saito.peer} peer to remove
 *
 **/
Network.prototype.cleanupDisconnectedSocket = function cleanupDisconnectedSocket(peer) {

  for (let c = 0; c < this.peers.length; c++) {
    if (this.peers[c] == peer) {

      //
      // do not remove peers we asked to add
      //
      if (this.app.options.peers != null) {
        for (let d = 0; d < this.app.options.peers.length; d++) {
          if (this.app.options.peers[d].host == peer.peer.host && this.app.options.peers[d].port == peer.peer.port) {
            return;
          }
        }
      }

      //
      // do not remove peers serving dns
      //
      if (this.app.options.peers != null) {
        if (this.app.options.dns != null) {
          for (let d = 0; d < this.app.options.dns.length; d++) {
            if (this.app.options.dns[d].host == peer.peer.host && this.app.options.dns[d].port == peer.peer.port) {
              return;
            }
          }
        }
      }


      //
      // otherwise, remove peer
      //
      clearInterval(this.peers[c].message_queue_timer);
      this.peers.splice(c, 1);
      c--;
      this.peers_connected--;
    }
  }
}




