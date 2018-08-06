const assert = require('chai').assert

const Network = require('../lib/saito/network');

describe('NETWORK', () => {
  const network = new Network();

  describe('Constructor', () => {
    it('should have all necessary fields for a Block object', () => {
      assert(network.app !== undefined)
    });
  });

  describe('isPrivateNetwork', () => {
    it(`should return true if it's a private network`, () => {
      assert.equal(network.isPrivateNetwork(), true);
    });
  });

});