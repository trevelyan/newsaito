const assert = require('chai').assert

const Burner = require('../lib/saito/burner');

describe('BURNER', () => {
  const burner = new Burner();

  describe('Constructor', () => {
    it('should have all necessary fields for a Blockchain object', () => {
      assert.equal(burner.burnfee, 2)
      assert.equal(burner.desired_block_time, 30000)
    });
  });

  describe('Calculate Burn Fee', () => {
    it('should calculate the burnfee linearly based on desired_block_time', () => {
      var burnfee = burner.calculateBurnFee(30000);
      assert.equal(burnfee, 0)
      burnfee = burner.calculateBurnFee(15000);
      assert.equal(burnfee, 1)
      burnfee = burner.calculateBurnFee(0);
      assert.equal(burnfee, 2)
    });
  });
});