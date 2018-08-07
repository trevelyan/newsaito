const assert = require('chai').assert

const BurnFee = require('../lib/saito/burnfee');
const Block   = require('../lib/saito/block');

describe('BURNFEE', () => {

  var app = {};
  const burnfee = new BurnFee();
  const bf = { start: 2 };

  describe('Constructor', () => {
    it('should have all necessary fields for a Blockchain object', () => {
    });
  });

  describe('Calculate Burn Fee', () => {
    it('should calculate the burnfee linearly based on desired_block_time', () => {
      var required_burnfee = burnfee.returnBurnFeeNeeded(bf, 0);
      assert.equal(required_burnfee, 2)
      var required_burnfee = burnfee.returnBurnFeeNeeded(bf, 15000);
      assert.equal(required_burnfee, 1.5)
      var required_burnfee = burnfee.returnBurnFeeNeeded(bf, 30000);
      assert.equal(required_burnfee, 1)
      var required_burnfee = burnfee.returnBurnFeeNeeded(bf, 60000);
      assert.equal(required_burnfee, 0)
    });
  });
});
