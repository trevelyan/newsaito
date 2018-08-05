'use strict'

const saito = require('../saito');
const Big = require('big.js');


/**
 * BurnFee Constructor
 * @param {*} app
 */
function BurnFee() {

  if (!(this instanceof BurnFee)) {
    return new BurnFee();
  }

  // blocks have json in them 
  //
  // bf = {}
  // bf.start = 2;
  // bf.step  = 0.00165;
  // bf.target = 120;

  return this
}
module.exports = BurnFee;


/**
 * Calculates the burnfee using the last block time, current time, and burnfee as a linear function
 * @param {int} elapsed_blocktime
 * @return {int} calculated_burn_fee
 */
BurnFee.prototype.calculateBurnFee = function calculateBurnFee(prevblk=null, elapsed_time=0) {

  if (prevblk == null) { return 0; }

  let calculated_burn_fee = prevblk.block.bf.start - (prevblk.block.bf.step * (elapsed_time / prevblk.block.bf.target ));

  if (calculated_burn_fee < 0) {
    return 0;
  } else {
    return calculated_burn_fee;
  }

}


/**
 * Tells us if we can produce a block given previous block and burn value (in txs)
 * @param {block} previous block
 * @returns {int} burn value of txs
 */
BurnFee.prototype.canBundleBlock = function canBundleBlock(prevblk=null, burn_value=0.0) {

  let prevblk_ts = 0;
  if (prevblk != null) { prevblk_ts = prevblk.block.ts; }

  let unixtime_current = new Date().getTime();
  let elapsed_time = unixtime_current - prevblk_ts;
  let burn_value_needed = this.calculateBurnFee(prevblk, elapsed_time);

  if (burn_value >= burn_value_needed) { 
    return 1;
  } else {
    return 0;
  }

}



