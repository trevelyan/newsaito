'use strict';

const saito = require('../saito');
const fs = require('fs');
const path = require('path');
const Big = require('big.js');


/////////////////
// Constructor //
/////////////////
function Mempool(app) {

  if (!(this instanceof Mempool)) {
    return new Mempool(app);
  }

  this.app = app || {};

  this.directory = path.join(__dirname, '../data/');

  this.transactions = []; // array
  this.downloads = []; // queue fifo
  this.blocks = []; // queue fifo
  this.recovered = []; // array of recovered txs
  // used when reorgs affect
  // our old blocks

  this.currently_bundling = 0;
  this.bundling_speed = 50;

  return this;

}
module.exports = Mempool;


////////////////
// initialize //
////////////////
//
// start the loop to try and bundle blocks
//
Mempool.prototype.initialize = function initialize() {

  var mempool_self = this;

  if (mempool_self.app.BROWSER == 0 || mempool_self.app.SPVMODE == 0) {

    // use a timeout to get network class a
    // bit of time to initialize. otherwise
    // we can have problems with calls to
    // returnNumberOfPeers() etc.
    // older - setTimeout(function() {
    mempool_self.startBundling();
    // older - }, 1000);
  }

}


///////////////////
// startBundling //
///////////////////
//
// start our loop that attempts to bundle blocks
//
Mempool.prototype.startBundling = function startBundling() {

  if (this.currently_bundling == 1) {
    return;
  }

  //var mempool_self = this;

  // older - this.bundling_timer = setInterval(function() { mempool_self.tryToBundleBlock(); }, this.bundling_speed);
  mempool_self.tryToBundleBlock();
}

Mempool.prototype.tryToBundleBlock = function tryToBundleBlock() {

    //check if we have golden ticket from last block?

    //check with monitor that we are ready to bundle block.

    var latestBlk = mempool_self.app.blockchain.returnLatestBlock();
    if (latestBlk == null) {
      latestBlk = new saito.block(mempool_self.app);
      latestBlk.block.id = 0;
    } else {
      block_paysplit_vote = mempool_self.app.voter.returnPaysplitVote(latestBlk.block.paysplit);
    }

    if (this.returnBurnFee(latestBlk) >= this.returnFeesAvailable()) {

      console.log((new Date()) + ": " + this.returnBurnFee(latestBlk) + " - " + returnFeesAvailable();

        // checks for edge cases around starting and flooding.

        mempool_self.bundleBlock(latestBlk);
      }

    }

    Mempool.prototype.returnBurnFee = function returnBurnFee(last_block_time) {
      //will get these from elsewhere later
      var desiredBlockTime = 30000;
      var burnfee = 2;

      var bf = 0;
      let unixtime_current = new Date().getTime();
      var elapsed_blocktime = unixtime_current - last_block_time;

      if (elapsed_blocktime >= desiredBlockTime * 2) {
        return 0;
      } else {
        // line below is the burn fee algorithm - can be updated to anything
        // that depends on the burn fee and desired block time
        bf = burnfee - (burnfee * (desiredBlockTime / elapsed_blocktime));
        return bf;
      }
    }

    Mempool.prototype.returnFeesAvailable = function returnFeesAvailable {
      let fees_available = Big(mempool_self.returnUsableTransactionFees(block_paysplit_vote));
      if (fees_available.lt(0)) {
        fees_available = Big(0);
      }
      return fees_available;
    }
