'use strict'

/**
 * BurnFee Constructor
 */
function BurnFee() {

  if (!(this instanceof BurnFee)) {
    return new BurnFee();
  }

  this.bf         = {}
  this.bf.start   = 2;
  this.bf.target  = 30000;

  return this;
}
module.exports = BurnFee;


/**
 * Calculates the burnfee using the last block time, current time, and burnfee as a linear function
 * @param {burnfee} bf
 * @param {int} elapsed_blocktime
 * @return {int} calculated_burn_fee
 */
BurnFee.prototype.calculateBurnFee = function calculateBurnFee(burnObj, elapsed_time=0) {

  if (burnObj == null) { return 0; }

  let { bf } = burnObj;

  let calculated_burn_fee = bf.start - (bf.start * (elapsed_time / bf.target ));

  if (calculated_burn_fee < 0) {
    return 0;
  } else {
    return calculated_burn_fee;
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

  let unixtime_current = new Date().getTime();
  let elapsed_time = unixtime_current - prevblk_ts;
  let burn_value_needed = this.calculateBurnFee(prevblk, elapsed_time);

  return burn_value >= burn_value_needed

}



