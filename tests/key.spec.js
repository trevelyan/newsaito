const assert = require('chai').assert

const saito = require('../lib/saito');

/**
 * Remind to go back and change the impl of all these functions are the code
 */

describe('KEY', () => {
  describe('Constructor', () => {
    const key = new saito.key();

    it('publicKey should be a String', () => {
      assert.isString(key.publickey);
    });

    it('tags should be an array', () => {
      assert.isArray(key.tags);
    });

    it('identifiers should be an array', () => {
      assert.isArray(key.identifiers);
    });

    it('watched should be a boolean value', () => {
      assert.isBoolean(key.watched);
    });

    it('lock_clock should be a boolean', () => {
      assert.isBoolean(key.lock_block);
    });

    it('aes_publickey should be a string', () => {
      assert.isString(key.aes_publickey);
    });

    it('aes_privatekey should be a string', () => {
      assert.isString(key.aes_privatekey);
    });

    it('aes_secret should be a string', () => {
      assert.isString(key.aes_secret);
    });
  });

  describe('isIdentifier', () => {
    const key = new saito.key();

    it('should return false if there are no identifiers', () => {
      assert.equal(key.isIdentifier(""), false);
    });

    it('should return true if identifier exists', () => {
      key.identifiers.push("bearguy@saito");
      assert.equal(key.isIdentifier("bearguy@saito"), true);
    });
  });

  describe('hasSharedSecret', () => {
    const key = new saito.key();

    it('should return false if aes_secret is not set', () => {
      assert.equal(key.hasSharedSecret(), false);
    });

    it('should return true if the aes_secret is set', () => {
      key.aes_secret = "secret";
      assert.equal(key.hasSharedSecret(), true);
    });
  });

  describe('addIdentifier', () => {
    const key = new saito.key();

    it('should add identifier to key.identifiers if its unique', () => {
      key.addIdentifier("example@saito");
      assert.equal(key.identifiers.length, 1);
    });

    it('should not add identifier if it exists', () => {
      key.addIdentifier("example@saito");
      assert.equal(key.identifiers.length, 1);
    });
  });

  describe('addTag', () => {
    const key = new saito.key();

    it('should add tag to key.tags if its unique', () => {
      key.addTag("tag");
      assert.equal(key.tags.length, 1);
    });

    it('should not add tag if it exists', () => {
      key.addTag("tag");
      assert.equal(key.tags.length, 1);
    });
  });

  describe('isWatched', () => {
    const key = new saito.key();

    it('should return false', () => {
      assert(!key.isWatched());
    });
  });

  describe('isTagged', () => {
    const key = new saito.key();

    it('should return false if tag is not present in array', () => {
      assert.equal(key.isTagged("tag"), false);
    });

    it('should return true if tag is present in array', () => {
      key.addTag("tag");
      assert.equal(key.isTagged("tag"), true);
    });
  });

  describe('removeIdentifier', () => {
    const key = new saito.key();

    it('should remove identifier if its present in array', () => {
      key.removeIdentifier("example@saito");
      assert.equal(key.identifiers.length, 0);
    });

    it('should early return if identifier is not present', () => {
      assert.equal(key.removeIdentifier(), undefined);
    });
  });

  describe('removeTag', () => {
    const key = new saito.key();

    it('should remove tag if its present in array', () => {
      key.removeTag("new_tag");
      assert.equal(key.tags.length, 0);
    });

    it('should early return if tag is not present', () => {
      assert.equal(key.removeTag(), undefined);
    });
  });
});