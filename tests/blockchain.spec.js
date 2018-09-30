const assert = require('chai').assert
const saito = require('../lib/saito')

describe('BLOCKCHAIN', () => {
  var app = {};
  app.mempool = new saito.mempool(app);
  const bchain = new saito.blockchain(app);

  describe('Constructor', () => {
    it('should have all necessary fields for a Blockchain object', () => {
      assert(bchain.app !== undefined);
    });
  });

  describe('Return Latest Block', () => {
    it('should return the latest Block from the Blockchain object', () => {
      assert.equal(bchain.returnLatestBlock(), null);
    });
  });

});
