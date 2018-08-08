const assert = require('chai').assert

const BurnFee = require('../lib/saito/burnfee');
const saito = require('../lib/saito');

describe('BURNFEE', () => {

  var app = {};
  // const burnfee = new BurnFee();
  const burnfee = new saito.burnfee(app);
  const bf = { start: 2 };

  describe('Constructor', () => {
    it('should have all necessary fields for a Blockchain object', () => {
    });
  });

  describe('Calculate Burn Fee', () => {
    it('should calculate the burnfee linearly based on desired_block_time', () => {
      var required_burnfee = burnfee.returnBurnFeeNeeded({block: {bf}}, 0);
      assert.equal(required_burnfee, 2)
      var required_burnfee = burnfee.returnBurnFeeNeeded({block: {bf}}, 15000);
      assert.equal(required_burnfee, 1.5)
      var required_burnfee = burnfee.returnBurnFeeNeeded({block: {bf}}, 30000);
      assert.equal(required_burnfee, 1)
      var required_burnfee = burnfee.returnBurnFeeNeeded({block: {bf}}, 60000);
      assert.equal(required_burnfee, 0)
    });
  });

  describe('Calculate change to Burn Fee', () => {
    it('should validate the burn fee', () => {
      let calc = burnfee.calculateBurnFee(null, 0);
      assert.equal(calc.start, 2);

      calc = burnfee.calculateBurnFee({block: {bf, ts: 15000}}, 200000);
      assert(calc.start > 2);
    });
  });
});
