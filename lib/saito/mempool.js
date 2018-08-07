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
  if (blk.is_valid == 0) { return false; }

  for (let i = 0; i < this.blocks.length; i++) {
    if (this.blocks[i].returnHash() == blk.returnHash()) { return false; }
  }

  this.blocks.push(blk);
}


/**
 * Starts bundling block if there is enough available funds and if bundling_active is false
 */
Mempool.prototype.bundleBlock = async function bundleBlock() {

console.log("CAN WE BUNDLE?: " + this.app.monitor.canMempoolBundleBlock());

  // ensure not bundling
  if (this.app.monitor.canMempoolBundleBlock() == false) { return; }
  this.bundling_active = true;

console.log("YES");


  let prevblk = this.app.blockchain.returnPreviousBlock();
  let vote    = 0;
  let credits = "0.0";

  if (prevblk != null) {
    vote = this.app.voter.returnPaysplitVote(prevblk.block.paysplit);
    credits = this.returnAvailableFees(vote);
    console.log("PREVLK: " + JSON.stringify(prevblk.block));
    console.log(`${new Date()} : ${this.app.burnfee.returnBurnFeeNeeded(prevblk.block.bf, ((new Date().getTime()) - prevblk.block.ts))} ---- ${credits}`)
  }

  if (this.app.burnfee.canBundleBlock(prevblk, credits)) {

    if (
      this.app.network.isPrivateNetwork() ||
      this.transactions.length > 0
    ) {

      console.log("Huzzah!");

      try {

        //
        // create new block
        //
        var blk = new saito.block(this.app);
        blk.block.creator = this.app.wallet.returnPublicKey();

console.log("Huzzah 2!");

        if (prevblk != null) {
          blk.block.prevhash = prevblk.returnHash();
        }

console.log("Huzzah 3!");


        //
        // and add to queue
        //

console.log("BLK: " + JSON.stringify(prevblk));

        var bundle_success = await blk.bundle(prevblk);
console.log("DID BUNDLING SUCCEED: " + bundle_success);

        this.addBlock(blk);

        console.log("Blocks in Queue: " + this.blocks.length);
        this.bundling_active = false;
        return;
      } catch(err) {
        console.log("ERROR: bundling block together: " + err);
      }
    }
  }



  // reset for next loop
console.log("RESETTING BUNDLING ACTIVE");
  this.bundling_active = false;

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

