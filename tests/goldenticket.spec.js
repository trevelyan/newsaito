const assert = require('chai').assert;

const Goldenticket = require('../lib/saito/goldenticket');

describe('GOLDENTICKET', () => {
  const goldenticket = new Goldenticket();

  describe('Constructor', () => {
    it('should have all necessary fields for a Storage object', () => {
      assert(goldenticket.app !== undefined);
      assert.equal(goldenticket.target, null);
      assert.equal(goldenticket.vote, null);
      assert.equal(goldenticket.random, null);
    });
  });
});
