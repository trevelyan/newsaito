const assert = require('chai').assert;

const Mempool = require('../lib/saito/mempool');

describe('MEMPOOL', () => {
  const mempool = new Mempool();

  describe('Constructor', () => {
    it('should have all necessary fields for a Storage object', () => {
      assert(mempool.app !== undefined)
      assert(mempool.directory !== undefined)
      assert.deepEqual(mempool.transactions, [])
      assert.deepEqual(mempool.downloads, [])
      assert.deepEqual(mempool.blocks, [])
      assert.deepEqual(mempool.recovered, [])
    });
  });

});