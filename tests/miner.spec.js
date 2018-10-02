const assert = require('chai').assert;

const Miner = require('../lib/saito/miner');

describe('MINER', () => {
  const miner = new Miner();

  describe('Constructor', () => {
    it('should have all necessary fields for a Storage object', () => {
      assert(miner.app !== undefined);
      assert.equal(miner.mining_active, false);
      assert.equal(miner.mining_speed, 2000);
      assert.equal(miner.minging_timer, null);
    });
  });

});
