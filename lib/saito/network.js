const saito = require('../saito');


/**
 * Network Constructor
 * @param {*} app
 */
function Network(app) {

  if (!(this instanceof Network)) {
    return new Network(app);
  }

  this.app     = app || {};

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

  return 1;

}


