const assert = require('chai').assert

const Big = require('big.js');
const saito = require('../lib/saito');
// const Block = require('../lib/saito/block');

describe('BLOCK', () => {
  var app = {};
  app.crypto = new saito.crypto();
  var newblock = new saito.block(app);

  describe('Constructor', () => {
    it('should be valid block', () => {
      assert.deepEqual(newblock.is_valid, 1)
    });
  });

  describe('returnHash', () => {
    it('should return a string of the hash created from signatureSource()', () => {
      assert.isString(newblock.returnHash());
    });

    it('should return the same value after multiple calls', () => {
      let hash = newblock.returnHash();
      assert.equal(hash, newblock.returnHash());
    });
  });

  describe('returnSignatureSource', () => {
    it('should return a string', () => {
      assert.isString(newblock.returnSignatureSource());
    });
  });

  describe('returnMaxTxId', () => {
    it('should return this.maxtid if it exists', () => {
      assert.equal(newblock.returnMaxTxId(), 0);
    });

    it('should return a greater number if it finds one', () => {
      newblock.transactions.push(new saito.transaction());
      assert.equal(newblock.returnMaxTxId(), 1);
    });
  });

  describe('returnMinTxId', () => {
    it('should return this.mintid if it exists', () => {
      assert.equal(newblock.returnMinTxId(), 1)
    });

    it('should return the lesser number of all that it finds', () => {
      newblock.transactions.push(new saito.transaction());
      assert.equal(newblock.returnMinTxId(), 1);
    });
  });
});
