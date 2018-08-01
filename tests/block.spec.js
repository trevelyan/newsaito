const assert = require('chai').assert

const Big = require('big.js');
const Block = require('../lib/saito/block');

describe('BLOCK', () => {
  const block = new Block();

  describe('Constructor', () => {
    it('should have all necessary fields for a Block object', () => {
      assert.isNumber(block.block.unixtime, "type of unixtime")
      assert.equal(block.block.prevhash, "")
      assert.equal(block.block.merkle, "")
      assert.equal(block.block.miner, "")
      assert.equal(block.block.id, 0)
      assert.deepEqual(block.block.transactions, [])
      assert.equal(block.block.burn_fee, 2.0)
      assert.equal(block.block.fee_step, 0.000165)
      assert.equal(block.block.difficulty, 0.0)
      assert.equal(block.block.paysplit, 0.5)
      assert.deepEqual(block.block.treasury, Big("10000000000.0"))
      assert.deepEqual(block.block.coinbase, Big("0.0"))
      assert.deepEqual(block.block.reclaimed, Big("0.0"))
      assert.equal(block.block.paysplit_vote, 0)
      assert.equal(block.confirmations, -1)
    });
  });

});