'use strict';

const saito = require('../saito');
const fs = require('fs');
const path = require('path');
const Big = require('big.js');


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
  this.transactions       = []; // array

  this.bundling_active    = 0;
  this.bundling_speed     = 1000;
  this.bundling_timer     = null;

  this.burnfee = 2;
  this.desired_block_time = 30000;

  return this;

}
module.exports = Mempool;


/**
 * Initializes mempool and starting trying to bundle blocks
 */
Mempool.prototype.initialize = function initialize() {

  var mempool_self = this;

  if (mempool_self.app.BROWSER == 0 || mempool_self.app.SPVMODE == 0) {
    mempool_self.bundling_timer = setInterval(() => {
      mempool_self.bundleBlock();
    }, mempool_self.bundling_speed);
  }

}


/**
 * Checks available funds and burn fee to determine if a block can be bundled
 */
Mempool.prototype.bundleBlock = function bundleBlock() {

  var mempool_self = this;

  //
  // TODO
  //
  // do we use a monitoring class as in the previous version?
  //
  // there are various points at which we do not want to bundle
  // including during block creation and adding blocks to the
  // blockchain. Since these are handled by other parts of the 
  // core code, we should figure out our best approach.
  //
  // ensure not bundling
  //
  if (mempool_self.bundling_active == 1) { return; }
  mempool_self.bundling_active = 1;


  let prevblk = this.app.blockchain.returnPreviousBlock();


  //
  //
  if (mempool_self.app.burnfee.canBundleBlock(prevblk, 0.0) == 1) {

    if (
      mempool_self.app.network.isPrivateNetwork() == 1 ||
      mempool_self.transactions.length > 0
    ) {
      console.log("HUZZAH: we can create a block");
      process.exit(1)
    }

  }

  // reset for next loop
  mempool_self.bundling_active = 0;

}


