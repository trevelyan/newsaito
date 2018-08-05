const assert = require('chai').assert
const saito = require('../lib/saito')

const Block = require('../lib/saito/block');
const Blockchain = require('../lib/saito/blockchain');

describe('BLOCKCHAIN', () => {
  const bchain = new Blockchain({});

  describe('Constructor', () => {
    it('should have all necessary fields for a Blockchain object', () => {
      assert(bchain.app !== undefined);
      assert.deepEqual(bchain.blocks, []);
    });
  });

  describe('Return Latest Block', () => {
    it('should return the latest Block from the Blockchain object', () => {
      var newblock = new Block();
      var tmpblock = bchain.returnLatestBlock();

      tmpblock.block.creation_time = 0
      newblock.block.creation_time = 0

      assert.instanceOf(tmpblock, Block);
      assert.deepEqual(tmpblock, newblock);

      bchain.blocks.push(tmpblock)

      console.log(bchain);

      var return_block = bchain.returnLatestBlock();
      assert.deepEqual(tmpblock, return_block)
    });
  });

});