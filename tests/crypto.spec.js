const assert = require('chai').assert;

const Crypto = require('../lib/saito/crypto');

// ***CRYPT***
describe('CRYPTO', () => {
  const crypto = new Crypto();

  // hashing a string (with 2x SHA256)
  describe('hashing', () => {
    it('should hash a string according to double SHA256', () => {
      hashedString = "67e6834f2fbad3fe2d79d6bcc2173d6d39cc4cc488ed70e36b69e950c425bfbe";
      assert.equal(crypto.hash("saito"), hashedString);
    });
  });

  // converting hex string to base58 and back
  describe('toBase58', () => {
    it('should convert hex string to base58', () => {
      base58String = "26GwX";
      assert.equal(crypto.toBase58("bc614e"), base58String);
    });
  });

  describe('fromBase58', () => {
    it('should convert base58 string to hex', () => {
      hexString = "bc614e";
      assert.equal(crypto.fromBase58("26GwX"), hexString);
    });
  });

  var privateKey = crypto.generateKeys();
  var publicKey = crypto.returnPublicKey(privateKey);
  // testing keys
  describe('keys', () => {
    it('verify a public key is a public key', () => {
      assert(crypto.isPublicKey(publicKey));
    });
    it('verify a private key is not a public key', () => {
      assert(!crypto.isPublicKey(privateKey));
    });
    it('successfully uncompress and compress a public key', () => {
      uncompressedPubKey = crypto.uncompressPublicKey(publicKey);
      assert.equal(crypto.compressPublicKey(uncompressedPubKey), publicKey);
    });
  });

  describe('verifying signatures', () => {
    var signedMessage = crypto.signMessage("Hello World", privateKey);

    it('verify msg signed with private key of a given pub key (true)', () => {
      assert(crypto.verifyMessage("Hello World", signedMessage, publicKey));
    });
    it('verify msg signed with private key of a given pub key (false)', () => {
        assert(!crypto.isPublicKey("Hello Saito", signedMessage, publicKey));
    });
  });

})