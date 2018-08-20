'use strict'

const Big = require('big.js')

/**
 * BurnFee Constructor
 */
function BurnFee() {

  if (!(this instanceof BurnFee)) {
    return new BurnFee();
  }

  // default values
  this.start         = 2;
  this.heartbeat     = 5;        // expect new block every 30 seconds
				  // maximum heartbeat is 2x the heartbeat
				  // see below in returnBurnFeeNeeded
  return this;
}
module.exports = BurnFee;


/**
 * Returns the burn fee needed given the burnfee object and the time elapsed
 * @param {burnfee} bf
 * @param {int} elapsed_time time since last block
 * @return {int} calculated_burn_fee
 */
BurnFee.prototype.returnBurnFeeNeeded = function returnBurnFeeNeeded(prevblk, elapsed_time=0) {

  if (prevblk == null) { return 0; } else { var { bf } = prevblk.block; }

  // our maximum blocktime is 2x the heartbeat (1000 converts to milliseconds)
  let burn_fee_needed = bf.start - (bf.start * (elapsed_time / (this.heartbeat * 1000 * 2) ));

  if (burn_fee_needed <= 0) {
    return 0;
  } else {
    return burn_fee_needed;
  }

}


/**
 * Returns a boolean value if burn_value is greater than the calculated burn_value_needed
 * @param {block} prevblk previous block
 * @returns {boolean} is the burn value greater than the necessary burn fees?
 */
BurnFee.prototype.returnBurnFeeNeededNow = function returnBurnFeeNeededNow(prevblk=null) {
  let prevblk_ts = 0;
  if (prevblk != null) { prevblk_ts = prevblk.block.ts; }
  return this.returnBurnFeeNeeded(prevblk, ((new Date().getTime()) - prevblk_ts));
}


/**
 * Calculates what the blk_bf should be given a previous block
 * @param {saito.block} prevblk previous block
 * @returns {saito.block} burn fee object
 */
BurnFee.prototype.calculateBurnFee = function calculateBurnFee(prevblk=null, blk_ts=null) {

  if (prevblk == null || blk_ts == null) {
    return { start: this.start };
  }

  var bf = {};
  bf.start = prevblk.block.bf.start * Math.sqrt( (blk_ts - prevblk.block.ts) / (this.heartbeat * 1000 * 2) );
  return bf;

}


/**
 * Validates the burn fee was calculated correctly
 * @param {saito.block} prevblk
 * @param {saito.block} blk
 * @returns {boolean} is it valid?
 */
BurnFee.prototype.validateBurnFee = function validateBurnFee(prevblk=null, blk=null) {

  if (prevblk == null || blk == null) {
    console.log("VALIDATE BURN FEE NOT WORKING");
    process.exit(1);
  }

  let correct_start = prevblk.block.bf.start * Math.sqrt( (blk.block.ts - prevblk.block.ts) / (this.heartbeat * 1000 * 2) );
  if (blk.block.bf.start == correct_start) { return true; }

  return false;

}

