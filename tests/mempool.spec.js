const assert = require('chai').assert;

const Mempool = require('../lib/saito/mempool');

describe('MEMPOOL', () => {
  const mempool = new Mempool();

  describe('Constructor', () => {
    it('should have all necessary fields for a Storage object', () => {
      assert(mempool.app !== undefined)
      assert(mempool.directory !== undefined)
      assert.deepEqual(mempool.transactions, [])
      assert.equal(mempool.bundling_speed, 1000);
      assert.equal(mempool.bundling_timer, null);
    });
  });
});