const assert = require('chai').assert

const BurnFee = require('../lib/saito/burnfee');
const saito = require('../lib/saito');

describe('BURNFEE', () => {

  var app = {};
  // const burnfee = new BurnFee();
  const burnfee = new saito.burnfee(app);
  const bf = { start: 2 };

  describe('Constructor', () => {
    it('should have all necessary fields for a Blockchain object', () => {});
  });

  describe('Calculate Burn Fee', () => {
    it('should calculate the burnfee linearly based on desired_block_time', () => {
      var required_burnfee = burnfee.returnMovingBurnFee({block: {bf}}, 15000);
      assert.isNumber(required_burnfee);
    });
  });

  describe('burnFeeAdjustment', () => {
    it('should adjust bf.start value by square of timestamp difference', () => {});
  });

  describe('validateBurnFee', () => {
    it('should validate the burn fee and return boolean', () => {});
  });
});
