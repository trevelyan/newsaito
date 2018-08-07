'use strict'

/**
 * BurnFee Constructor
 */
function BurnFee() {

  if (!(this instanceof BurnFee)) {
    return new BurnFee();
  }

  // default values
  this.start         = 2;
  this.heartbeat     = 30;        // expect new block every 30 seconds
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
BurnFee.prototype.returnBurnFeeNeeded = function returnBurnFeeNeeded(prevblk_bf, elapsed_time=0) {

  if (prevblk_bf == null) { return 0; }

  // our maximum blocktime is 2x the heartbeat
  let burn_fee_needed = prevblk_bf.start - (prevblk_bf.start * (elapsed_time / (this.heartbeat/2) ));


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
BurnFee.prototype.canBundleBlock = function canBundleBlock(prevblk=null, burn_value=0.0) {

  let prevblk_ts = 0;
  if (prevblk != null) { prevblk_ts = prevblk.block.ts; }

  let elapsed_time = (new Date().getTime()) - prevblk_ts;
  let burn_value_needed = this.returnBurnFeeNeeded(prevblk, elapsed_time);

  return (burn_value >= burn_value_needed);

}



/**
 * Calculates what the blk_bf should be given a previous block
 * @param {block} prevblk previous block
 * @returns {blk_vf} is the burn fee object
 */
BurnFee.prototype.calculateBurnFee = function calculateBurnFee(prevblk=null, blk_ts=null) {

  if (prevblk == null || blk_ts == null) {
    return { start: start };
  }
  
  var bf = {};
  bf.start = prevblk.block.bf.start * Math.sqrt( (prevblk.block.ts - blk_ts) / this.heartbeat );
  return bf;

}
BurnFee.prototype.validateBurnFee = function validateBurnFee(prevblk=null, blk=null) {

  if (prevblk == null || blk == null) {
    console.log("VALIDATE BURN FEE NOT WORKING");
    process.exit(1);
  }

  let correct_start = prevblk.block.bf.start * Math.sqrt( (prevblk.block.ts - blk_ts) / this.heartbeat );
  if (blk.block.bf.start == correct_start) { return true; }

  return false;

}

