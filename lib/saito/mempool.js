'use strict';
const Big = require('big.js')
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

  this.processing_active  = false;
  // this.processing_speed   = 1000;
  // this.processing_timer   = null;

  this.clearing_active    = false;

  this.blocking           = false;
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
 * Adds block to Mempool queue
 */
Mempool.prototype.addBlock = function addBlock(blk) {
  if (blk == null) { return false; }
  if (!blk.is_valid) { return false; }

  for (let i = 0; i < this.blocks.length; i++) {
    if (this.blocks[i].returnHash() == blk.returnHash()) { return false; }
  }

  this.blocks.push(blk);
  this.bundling_active = false;
}


/**
 * Starts bundling block if there is enough available funds and if bundling_active is false
 */
Mempool.prototype.bundleBlock = async function bundleBlock() {
  // ensure not bundling
  if (this.app.monitor.canMempoolBundleBlock() == false) { return; }
  this.bundling_active = true;

  let prevblk = this.app.blockchain.returnPreviousBlock();
  let vote    = 0;
  let credits = "0.0";

  if (prevblk != null) {
    vote = this.app.voter.returnPaysplitVote(prevblk.block.paysplit);
    credits = this.returnAvailableFees(vote);
    console.log(`${new Date()} : ${this.app.burnfee.returnBurnFeeNeeded(prevblk, ((new Date().getTime()) - prevblk.block.ts)).toFixed(8)} ---- ${credits}`)
  }

  if (this.app.burnfee.canBundleBlock(prevblk, credits)) {

    if (
      this.app.network.isPrivateNetwork() ||
      this.transactions.length > 0
    ) {

      try {

        //
        // create new block
        //
        var blk = new saito.block(this.app);
        blk.block.creator = this.app.wallet.returnPublicKey();

        if (prevblk != null) {
          blk.block.prevhash = prevblk.returnHash();
        }


        //
        // and add to queue
        //

        blk.bundle(prevblk);

        this.addBlock(blk);

        console.log("Blocks in Queue: " + this.blocks.length);

        this.processBlocks();

        return;
      } catch(err) {
        console.log("ERROR: bundling block together: " + err);
      }
    }
  }

  // reset for next loop
  this.bundling_active = false;

}

/**
 * Clears block and transactions from mempool
 * @param {*} blk
 */
Mempool.prototype.clearMempool = function clearMempool(blk) {
  if (blk == null) { return; }

  this.clearing_active = true;
  this.removeBlock(blk);
  this.clearing_active = false;
}

/**
 * Clear block from mempool queue
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
 * Pops a block from the beginning of the queue
 * @returns {saito.block} tmpblk
 */
Mempool.prototype.returnBlock = function returnBlock() {
  if (this.blocks.length == 0) { return null; }
  return this.blocks.shift();
}

/**
 * Requeues a block into the mempool
 * @param {saito.block} blk
 */
Mempool.prototype.requeueBlock = function requeueBlock(blk) {
  if (this.block == null) { return; }
  this.blocks.push(blk);
}

/**
 * Attempts to process blocks and add them to blockchain
 */
Mempool.prototype.processBlocks = function processBlocks() {

  if (this.processing_active) {
    console.log("Mempool processing.... not adding new block to blockchain");
    return;
  }

  if (this.blocks.length == 0) {
    console.log("Mempool processing.... no blocks to add to blockchain");
    this.processing_active = false;
    return;
  }

  while (this.blocks.length > 0) {

    if (this.clearing_active) { return; }
    if (this.processing_active) { return; }

    this.blocking = true;

    if (this.blocks.length == 0) {
      this.processing_active = false;
      return;
    }

    // monitor.canAddToBlockchain?
    // FIFO poping from our queue
    if(!this.app.blockchain.indexing_active) {
      var blk = this.returnBlock();

      if (blk == null) {
        this.processing_active = false;
        return;
      }
      else {
        this.app.blockchain.addBlockToBlockchain(blk)
      }
    }

    this.processing_active = false;
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

Mempool.prototype.addBlock = function addBlock() {

}