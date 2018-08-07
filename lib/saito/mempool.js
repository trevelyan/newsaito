'use strict';
const saito = require('../saito');
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
  this.blocks             = [];
  this.transactions       = [];

  this.bundling_active    = false;
  this.bundling_speed     = 1000;
  this.bundling_timer     = null;

  this.bundling_clearing   = false;

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
 * Add block
 */
Mempool.prototype.addBlock = function addBlock(blk) {
  console.log("Do we get called?");
  this.blocks.push(blk)
}


/**
 * Starts bundling block if there is enough available funds and if bundling_active is false
 */
Mempool.prototype.bundleBlock = async function bundleBlock() {

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
      // process.exit(0)

      var newblk = new saito.block(this.app);

      newblk.block.creator = this.app.wallet.publickey;

      if (prevblk != null) {
        console.log("ADDING PREVHASH: " + prevblk.returnHash());
        newblk.block.prevhash = prevblk.returnHash();
      }

      for (let i = 0; i < this.transactions.length; i++) {
        newblk.addTransaction(this.transactions[i]);
      }
      // let my_fees    = Big(newblock.returnTransactionFeesUsableForBlockCreatorSurplusForThisBlock());
      // if (my_fees == null) { my_fees = Big(0.0); }
      // if (my_fees.gte(0)) {
      //   var tx2 = this.app.wallet.createFeeTransaction(my_fees.toFixed(8));
      //   newblock.addTransaction(tx2);
      // }
      try {
        await newblk.bundle(prevblk);
        await this.app.blockchain.validateBlockAndQueueInMempool(newblk, true); // true = propagate
        console.log("We can process Blocks");
        console.log(this.blocks);

        this.app.monitor.mempool_is_bundling = false;
        process.exit(0)
      } catch(err) {
        console.log(err);
      }

    }
  }

  // reset for next loop
  this.bundling_active = 0;

}


