const assert = require('chai').assert

const Big = require('big.js');
const Block = require('../lib/saito/block');

describe('BLOCK', () => {
  const newblock = new Block();

  describe('Constructor', () => {
    it('should have all necessary fields for a Block object', () => {
      assert.isNumber(newblock.block.ts, "type of timestamp (ts)")
      assert.equal(newblock.block.prevhash, "")
      assert.equal(newblock.block.merkle, "")
      assert.equal(newblock.block.miner, "")
      assert.equal(newblock.block.id, 0)
      assert.deepEqual(newblock.block.transactions, [])
      assert.deepEqual(newblock.block.bf, {})
      assert.equal(newblock.block.difficulty, 0.1875)
      assert.equal(newblock.block.paysplit, 0.5)
      assert.deepEqual(newblock.block.treasury, Big("10000000000.0"))
      assert.deepEqual(newblock.block.coinbase, Big("0.0"))
      assert.deepEqual(newblock.block.reclaimed, Big("0.0"))
      assert.equal(newblock.block.paysplit_vote, 0)
      assert.equal(newblock.confirmations, -1)
    });
  });

});