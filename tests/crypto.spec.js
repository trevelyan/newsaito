const chai = require('chai');
const should = chai.should();
const expect = chai.expect;

const Crypto = require('../lib/saito/crypto');

// ***CRYPT***
describe('CRYPT', function() {
  const crypto = new Cryptoo();

  // hashing a string (with 2x SHA256)
  describe('hashing', function() {
    it('should hash a string correctly', function(){
      hashedString = "67e6834f2fbad3fe2d79d6bcc2173d6d39cc4cc488ed70e36b69e950c425bfbe";
      assert.equal(crypto.hash("saito"), hashedString);
    });
  });

  // converting hex string to base58 and back
  describe('toBase58/fromBase58', function() {
    it('should convert hex string to base58', function(){
      base58String = "26GwX";
      assert.equal(crypto.toBase58("bc614e"), base58String);
    });
    it('should convert base58 string to hex', function(){
      hexString = "bc614e";
      assert.equal(crypto.fromBase58("26GwX"), hexString);
    });
  });

  var privateKey = crypto.generateKeys();
  var publicKey = crypto.returnPublicKey(privateKey);
  // testing keys
  describe('keys', function() {
    it('verify a public key is a public key', function(){
      assert(crypto.isPublicKey(publicKey));
    });
    it('verify a private key is not a public key', function(){
      assert(!crypto.isPublicKey(privateKey));
    });
    it('successfully uncompress and compress a public key', function(){
      uncompressedPubKey = crypto.uncompressPublicKey(publicKey);
      assert.equal(crypto.compressPublicKey(uncompressedPubKey), publicKey);
    });
  });

  describe('verifying signatures', function() {
    var signedMessage = crypto.signMessage("Hello World", privateKey);

    it('verify msg signed with private key of a given pub key (true)', function(){
      assert(crypto.verifyMessage("Hello World", signedMessage, publicKey));
    });
    it('verify msg signed with private key of a given pub key (false)', function(){
        assert(!crypto.isPublicKey("Hello Saito", signedMessage, publicKey));
    });
  });

})