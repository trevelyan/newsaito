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
  this.downloads          = []; // queue fifo
  this.blocks             = []; // queue fifo
  this.recovered          = []; // array of recovered txs
  // used when reorgs affect
  // our old blocks
  this.currently_bundling = 0;
  this.bundling_speed     = 1000;

  this.genesis_time       = new Date().getTime()

  this.burnfee = 2;
  this.desired_block_time = 30000;

  return this;

}
module.exports = Mempool;


/**
 * Initializes mempool and start a loop to try and bundle blocks
 */
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


/**
 * Start our loop that attempts to bundle blocks
 */
Mempool.prototype.startBundling = function startBundling() {

  if (this.currently_bundling == 1) {
    return;
  }

  this.bundling_timer = setInterval(() => {
    this.bundleBlock();
  }, this.bundling_speed);
}

/**
 * Checks available funds and burn fee to determine if a block can be bundled
 */
Mempool.prototype.bundleBlock = function bundleBlock() {

  //check if we have golden ticket from last block?

  //check with monitor that we are ready to bundle block.
  var latestBlk           = this.app.blockchain.returnLatestBlock();
  var currentTime;

  if (latestBlk.block.id == 0) {
    currentTime = this.genesis_time;
  } else {
    currentTime = latestBlk.block.creation_time
  }
  var latestBurnFee = this.returnBurnFee(currentTime);

  console.log(`${new Date()}: ${latestBurnFee}`);

  if (latestBurnFee <= 0) {

    console.log("WE CAN CREATE A BLOCK")
    process.exit(1)

  }
}

/**
 * Uses burner class to calculate the burn fee using the time the last block was produced
 * and the current time
 * @param {*} last_block_time
 * @returns {int} burnfee
 */
Mempool.prototype.returnBurnFee = function returnBurnFee(last_block_time) {
  // will get these from elsewhere later
  let unixtime_current = new Date().getTime();
  var elapsed_blocktime = unixtime_current - last_block_time;

  if (elapsed_blocktime >= this.desired_block_time * 2) {
    return 0;
  } else {
    return this.app.burner.calculateBurnFee(elapsed_blocktime);
  }
}


