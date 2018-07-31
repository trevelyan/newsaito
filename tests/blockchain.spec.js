const assert = require('chai').assert

const Blockchain = require('../lib/saito/blockchain');

describe('BLOCKCHAIN', () => {
  const bchain = new Blockchain();

  describe('Constructor', () => {
    it('should have all necessary fields for a Blockchain object', () => {
      assert(bchain.app !== undefined)
    });
  });

});