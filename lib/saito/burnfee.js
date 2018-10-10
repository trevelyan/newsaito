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
  this.start         = 200;
  this.heartbeat     = 5;        // expect new block every 30 seconds
				  // maximum heartbeat is 2x the heartbeat
				  // see below in returnMovingBurnFee
  return this;
}
module.exports = BurnFee;

///////////////////////////////
// Define the burn fee curve //
///////////////////////////////
/**
 * Returns the burn fee needed given the burnfee object and the time elapsed
 * @param {bf} block.bf object
 * @param {float} elapsed_time time since last block
 * @return {float} calculated_burn_fee
 */
// The curve is abstracted here for clarity and ease of adjustment
BurnFee.prototype.burnFeeCurve = function burnFeeCurve(bf, elapsed_time) {
  // Set maximum block time
  if ((elapsed_time/1000) > (this.heartbeat*2)) {return 0;}

  // List curve algorithms
  // y=n-x straight line descending
  // return bf.start - (bf.start * (elapsed_time / (this.heartbeat * 1000 * 2)));

  // y=n/x asymtotic curve
  return bf.start/(elapsed_time/1000);
}

/**
 * Returns the burn fee needed given the last block and the time elapsed
 * @param {saito.block} prvblock to obtain previous burn fee from
 * @param {int} elapsed_time time since last block
 * @return {float} calculated_burn_fee
 */
BurnFee.prototype.returnMovingBurnFee = function returnMovingBurnFee(prevblk, elapsed_time=0) {

  if (prevblk == null) { return 0; } else { var { bf } = prevblk.block; }

  // our maximum blocktime is 2x the heartbeat (1000 converts to milliseconds)
  let burn_fee_needed = this.burnFeeCurve(bf, elapsed_time);

  if (burn_fee_needed <= 0) {
    return 0;
  } else {
    return (Math.floor(burn_fee_needed * 100000000)/100000000);;
  }

}

/**
 * Returns a boolean value if burn_value is greater than the calculated burn_value_needed
 * @param {saito.block} prevblk previous block
 * @returns {boolean} is the burn value greater than the necessary burn fees?
 */
//Return the value on the burnFeeCurve now.
BurnFee.prototype.returnMovingBurnFeeNow = function returnMovingBurnFeeNow(prevblk=null) {
  let prevblk_ts = 0;
  if (prevblk != null) { prevblk_ts = prevblk.block.ts; }
  return this.returnMovingBurnFee(prevblk, ((new Date().getTime()) - prevblk_ts));
}



//Should this not be written to the block bf object?
// TODO: Write this into the bf object.
/**
 * Returns the burn fee that was needed for a block
 * @param {saito.block} block to return data for.
 * @return {float} calculated_burn_fee
 */
BurnFee.prototype.returnBurnFeePaidForThisBlock = async function returnBurnFeePaidForThisBlock(blk=null) {

  if (blk == null) { return 0; }
  if (blk.block.bf == null) { return 0; }
  if (blk.block.bf.current != undefined) { return blk.block.bf.current; }

  if (blk.block.prevhash == null) { return 0; }

  let prevblk = await blk.app.blockchain.returnBlockByHash(blk.block.prevhash);
  if (prevblk == null) { return 0; }
  if (prevblk.block == null) { return 0; }

  let elapsed_time = blk.block.ts - prevblk.block.ts;

  return this.returnMovingBurnFee(prevblk, elapsed_time);

}

// These functions adjusts and validate adjustments to the burn fee.
// The equations here pair with the equations above.
/**
 * Returns the burn fee needed given the burnfee object and the time elapsed
 * @param {saito.block} prvblock
 * @param {saito.block} block
 * @return {float} adjusted_burn_fee
 */
BurnFee.prototype.burnFeeAdjustment = function burnFeeAdjustment(prevblk=null, blk=null) {
  // Adjust the burn fee by the square root of the difference between the block time and desired block time
  return prevblk.block.bf.start * Math.sqrt((this.heartbeat * 1000)/(blk.block.ts - prevblk.block.ts));
}
/**
 * Calculates what the blk_bf should be given a previous block
 * @param {saito.block} prevblk previous block
 * @returns {saito.block} burn fee object
 */
BurnFee.prototype.adjustBurnFee = function adjustBurnFee(prevblk=null, blk=null) {

  if (prevblk == null || blk == null) {
    return { start: this.start };
  }

  var bf = {};
  bf.start = this.burnFeeAdjustment(prevblk, blk);
  bf.current = 0;
  if (prevblk != null && blk != null) {
    let elapsed = blk.block.ts - prevblk.block.ts;
    bf.current = this.returnMovingBurnFee(prevblk, elapsed);
  }
  //console.log("Burn Fee Adjusted to: " + bf.start)
  //console.log("Burn Fee Paid is: " + bf.current)
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

  let correct_start = this.burnFeeAdjustment(prevblk, blk);

  if (prevblk == null && blk == null) {
    if (blk.block.bf.current != 0) { return false; }
  } else {
    let elapsed = blk.block.ts - prevblk.block.ts;
    if (bf.current != this.returnMovingBurnFee(prevblk, elapsed)) {
      return false;
    } 
  }

  if (blk.block.bf.start == correct_start) { return true; }

  return false;

}

