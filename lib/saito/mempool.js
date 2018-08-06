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
  let vote    = 0;
  let credits = 0.0;

  if (prevblk != null) {
    vote = this.app.voter.returnPaysplitVote(prevblk.block.paysplit);
    credits = this.returnAvailableFees(vote);
  }

  if (this.app.burnfee.canBundleBlock(prevblk, credits)) {

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







/**
 * Returns the total "burn value" of the transaction fees in the mempool
 * that can be used to produce a block with a given paysplit vote
 *
 * Note the submission of our own wallet publickey into the transaction
 * class' returnFeesUsable function. This is unnecessary since the default
 * behavior of the function is to examine the transaction from our own
 * perspective. When the same function is called to verify the fees for
 * a block the creator publickey should be called.
 *
 * params {vote} paysplit vote
 * returns {string} credits available  
 */
Mempool.prototype.returnAvailableFees = function returnAvailableFees(vote=0) {

  var v = Big(0);
  for (let i = 0; i < this.transactions.length; i++) {
    if (vote == -1) {
      if (this.transactions[i].transaction.ps <= 0) {
        v = v.plus(Big(this.transactions[i].returnFeesUsable(this.app, this.app.wallet.returnPublicKey())));
      }
    }
    if (vote == 0) {
      v = v.plus(Big(this.transactions[i].returnFeesUsable(this.app, this.app.wallet.returnPublicKey())));
    }
    if (vote == 1) {
      if (this.transactions[i].transaction.ps >= 0) {
        v = v.plus(Big(this.transactions[i].returnFeesUsable(this.app, this.app.wallet.returnPublicKey())));
      }
    }
  }
  return v.toFixed(8);
}



