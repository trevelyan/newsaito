'use strict';

const path = require('path');

/**
 * Mempool Constructor
 * @param {*} app
 */
function Mempool(app) {

  if (!(this instanceof Mempool)) {
    return new Mempool(app);
  }

  this.app                = app || {};

  this.directory          = path.join(__dirname, '../data/');
  this.transactions       = [];

  this.bundling_active    = 0;
  this.bundling_speed     = 1000;
  this.bundling_timer     = null;

  return this;

}
module.exports = Mempool;


/**
 * Initializes mempool and starts trying to bundle blocks
 */
Mempool.prototype.initialize = function initialize() {
  if (this.app.BROWSER == 0 || this.app.SPVMODE == 0) {
    this.bundling_timer = setInterval(() => {
      this.bundleBlock();
    }, this.bundling_speed);
  }
}


/**
 * Starts bundling block if there is enough available funds and if bundling_active is false
 */
Mempool.prototype.bundleBlock = function bundleBlock() {

  // ensure not bundling
  if (this.app.monitor.canBundleBlock()) { return; }
  this.bundling_active = 1;

  let prevblk = this.app.blockchain.returnPreviousBlock();

  if (this.app.burnfee.canBundleBlock(prevblk, 0.0)) {

    if (
      this.app.network.isPrivateNetwork() ||
      this.transactions.length > 0
    ) {
      console.log("HUZZAH: we can create a block");
      process.exit(0)
    }

  }

  // reset for next loop
  this.bundling_active = 0;

}


