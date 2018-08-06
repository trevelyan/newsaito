const assert = require('chai').assert
const saito = require('../lib/saito')

const Block = require('../lib/saito/block');
const Blockchain = require('../lib/saito/blockchain');

describe('BLOCKCHAIN', () => {
  const bchain = new Blockchain({});

  describe('Constructor', () => {
    it('should have all necessary fields for a Blockchain object', () => {
      assert(bchain.app !== undefined);
    });
  });

  describe('Return Latest Block', () => {
    it('should return the latest Block from the Blockchain object', () => {
      assert.equal(bchain.returnPreviousBlock(), null);
    });
  });

});