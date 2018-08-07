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

      var newblk = new saito.block(this.app);

      newblk.block.creator = this.app.wallet.returnPublicKey();

      if (prevblk != null) {
        console.log("ADDING PREVHASH: " + prevblk.returnHash());
        newblk.block.prevhash = prevblk.returnHash();
      }

      for (let i = 0; i < this.transactions.length; i++) {
        newblk.addTransaction(this.transactions[i]);
      }

      try {
        await newblk.bundle(prevblk);
        this.queueBlock(await newblk.validate(), newblk);

        console.log("We can process Blocks");
        console.log(this.blocks);

        process.exit(0)
      } catch(err) {
        console.log(err);
      }

    }
  }

  // reset for next loop
  this.bundling_active = 0;

}

Mempool.prototype.queueBlock = function queueBlock(canAddBlock, newblk) {
  if (canAddBlock) {
    this.addBlock(newblk);
  } else {
    this.app.logger.logError("Reclaimed Funds found invalid",{message:"",err:""});

    this.removeBlock(blk);
    this.currently_reclaiming = false;
  }
}

/**
 * Adds block to Mempool queue
 */
Mempool.prototype.addBlock = function addBlock(blk) {
  if (blk == null) { return false; }
  if (blk.is_valid == 0) { return false; }

  for (let i = 0; i < this.blocks.length; i++) {
    if (this.blocks[i].returnHash() == blk.returnHash()) { return false; }
  }
  this.blocks.push(blk);
  this.currently_reclaiming = false;
}

/**
 * Removes block from Mempool queue
 */
Mempool.prototype.removeBlock = function removeBlock(blk) {
  if (blk == null) { return; }
  for (let b = this.blocks.length-1; b >= 0; b--) {
    if (this.blocks[b].returnHash() == blk.returnHash()) {
      this.block_size_current -= this.blocks[b].size;
      this.blocks.splice(b, 1);
    }
  }
}

/**
 * Returns the "usable value" of the transaction fees in the mempool
 * that can be used to produce a block with a given paysplit vote
 *
 * Note the submission of our own wallet publickey into the transaction
 * class' returnFeesUsable function. This is unnecessary since the default
 * behavior of the function is to examine the transaction from our own
 * perspective. When the same function is called to verify the fees for
 * a block the creator publickey should be called.
 *
 * @param {vote} paysplit vote
 * @returns {string} credits available
 */
Mempool.prototype.returnAvailableFees = function returnAvailableFees(vote=0) {

  var v = Big(0);
  for (let i = 0; i < this.transactions.length; i++) {
    switch(vote) {
      case -1:
        if (this.transactions[i].transaction.ps <= 0) {
          v = v.plus(Big(this.transactions[i].returnFeesUsable(this.app, this.app.wallet.returnPublicKey())));
        }
        break;
      case 1:
        if (this.transactions[i].transaction.ps >= 0) {
          v = v.plus(Big(this.transactions[i].returnFeesUsable(this.app, this.app.wallet.returnPublicKey())));
        }
        break;
      default:
        v = v.plus(Big(this.transactions[i].returnFeesUsable(this.app, this.app.wallet.returnPublicKey())));
        break;
    }
  }
  return v.toFixed(8);
}



