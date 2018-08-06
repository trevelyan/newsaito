const assert = require('chai').assert

const BurnFee = require('../lib/saito/burnfee');

describe('BURNFEE', () => {
  const burnfee = new BurnFee();

  describe('Constructor', () => {
    it('should have all necessary fields for a Blockchain object', () => {
      assert.equal(burnfee.bf.start, 2);
      assert.equal(burnfee.bf.target, 30000);
    });
  });

  describe('Calculate Burn Fee', () => {
    it('should calculate the burnfee linearly based on desired_block_time', () => {
      var calc_burnfee = burnfee.calculateBurnFee(burnfee, 30000);
      assert.equal(calc_burnfee, 0)
      calc_burnfee = burnfee.calculateBurnFee(burnfee, 15000);
      assert.equal(calc_burnfee, 1)
      calc_burnfee = burnfee.calculateBurnFee(burnfee, 0);
      assert.equal(calc_burnfee, 2)
    });
  });
});