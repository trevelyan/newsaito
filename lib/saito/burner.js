'use strict'

const saito = require('../saito');
const Big = require('big.js');

/**
 * Burner Constructor
 * @param {*} app
 */
function Burner(app) {
  if (!(this instanceof Burner)) {
    return new Burner(app);
  }

  this.app                = app || {}
  this.burnfee            = 2
  this.desired_block_time = 30000;

  return this
}
module.exports = Burner;

/**
 * Calculates the burnfee using the last block time, current time, and burnfee as a linear function
 * @param {int} elapsed_blocktime
 * @return {int} calculated_burn_fee
 */
Burner.prototype.calculateBurnFee = function calculateBurnFee(elapsed_blocktime) {
  let calculated_burn_fee = this.burnfee - (this.burnfee * (elapsed_blocktime / this.desired_block_time ));

  if (calculated_burn_fee < 0) {
    return 0;
  }

  return calculated_burn_fee;
}
