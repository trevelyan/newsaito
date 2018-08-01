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

  this.burnfee = 2;
  this.desiredBlockTime = 30000;

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

  //var block_paysplit_vote = mempool_self.app.voter.returnPaysplitVote(latestBlk.block.paysplit);
  var latestBlk           = mempool_self.app.blockchain.returnLatestBlock();
  var latestBurnFee       = this.returnBurnFee(latestBlk.creation_time)
  var latestFeesAvailable = this.returnFeesAvailable()

  if (latestBurnFee >= latestFeesAvailable) {

    console.log(`${new Date()}: ${latestBurnFee} - ${latestFeesAvailable}`);

    // checks for edge cases around starting and flooding.

    mempool_self.bundleBlock(latestBlk);
  }

}

Mempool.prototype.bundleBlock = function bundleBlock(latestBlk) {
  return
}

Mempool.prototype.returnBurnFee = function returnBurnFee(last_block_time) {
  //will get these from elsewhere later
  let unixtime_current = new Date().getTime();
  var elapsed_blocktime = unixtime_current - last_block_time;

  if (elapsed_blocktime >= desiredBlockTime * 2) {
    return 0;
  } else {
    // line below is the burn fee algorithm - can be updated to anything
    // that depends on the burn fee and desired block time
    // bf = burnfee - (burnfee * (desiredBlockTime / elapsed_blocktime));
    return this.calculateBurnFee(elapsed_blocktime);
  }
}

Mempool.prototype.calculateBurnFee = function calculateBurnFee(elapsed_blocktime) {
  return this.burnfee - (this.burnfee * (this.desiredBlockTime / elapsed_blocktime));
}

Mempool.prototype.returnFeesAvailable = function returnFeesAvailable() {
  let fees_available = Big(mempool_self.returnUsableTransactionFees(block_paysplit_vote));
  if (fees_available.lt(0)) {
    return Big(0);
  }
  return fees_available;
}
