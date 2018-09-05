const assert = require('chai').assert;

const saito = require('../lib/saito');

describe('MEMPOOL', () => {
  const app     = {};
  app.crypto    = new saito.crypto();
  const mempool = new saito.mempool(app);

  describe('Constructor', () => {
    it('should have all necessary fields for a Storage object', () => {
      assert(mempool.app !== undefined)
      assert(mempool.directory !== undefined)
      assert.deepEqual(mempool.transactions, [])
      assert.equal(mempool.bundling_speed, 1000);
      assert.equal(mempool.bundling_timer, null);
    });
  });

  describe('addBlock', () => {
    it('should return false if given a null block', () => {
      assert(!mempool.addBlock(null));
    });

    it('should return false if given a block with false field "is_valid"', () => {
      var falseblock = new saito.block(app);
      falseblock.is_valid = false;
      assert(!mempool.addBlock(falseblock));
    });

    it('should return false if mempool tries to add the same block', () => {
      var newblock = new saito.block(app);
      mempool.addBlock(newblock);
      assert.equal( mempool.blocks.length, 1);
      assert(!mempool.addBlock(newblock));
    });
  });

  describe('returnAvailableFees', () => {
    it('should return 0 fees if there are no txs regardless of vote', () => {
      assert(mempool.returnAvailableFees(0) == 0);
      assert(mempool.returnAvailableFees(1) == 0);
      assert(mempool.returnAvailableFees(-1) == 0);
    });

    // add tx tests when implemented
  });
});