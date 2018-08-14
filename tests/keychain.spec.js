const assert  = require('chai').assert;
const fs      = require('fs-extra');

const test    = require('./helpers/test');
const saito   = require('../lib/saito');

describe('KEYCHAIN', () => {
  var app = {};
  const key_data = [{
    publickey: "",
    watched: false,
    aes_publickey: "",
    aes_privatekey: "",
    aes_secret: "",
    identifiers: [],
    tags: []
  }];

  beforeEach(async () => {
    const crypto = new saito.crypto();

    var test_privkey = crypto.generateKeys();
    var test_publickey = crypto.returnPublicKey(test_privkey);

    key_data.publickey = test_publickey;

    try {
      app = await test.initSaito();
    } catch(err) {
      console.log(err);
    }
    app.options.keys = key_data;
  });

  after(() => {
    test.tearDown();
  });

  describe('Initialize', () => {
    it('should add new key to keychain', async () => {
      const keychain    = new saito.keychain(app);
      keychain.initialize();
      assert.equal(keychain.keys.length, 1);
    });

    it('should match key info with data from app.options', async () => {
      const keychain    = new saito.keychain(app);
      keychain.initialize();
      assert.equal(keychain.keys[0].publickey, key_data[0].publickey);
      assert.equal(keychain.keys[0].watched, key_data[0].watched);
      assert.equal(keychain.keys[0].aes_publickey, key_data[0].aes_publickey);
      assert.equal(keychain.keys[0].aes_privatekey, key_data[0].aes_privatekey);
      assert.equal(keychain.keys[0].aes_secret, key_data[0].aes_secret);
      assert.deepEqual(keychain.keys[0].identifiers, key_data[0].identifiers);
      assert.deepEqual(keychain.keys[0].tags, key_data[0].tags);
    });
  });

  describe('addKey', () => {

    it('should early return when not public key is passed', async () => {
      const keychain = new saito.keychain(app);
      keychain.addKey();

      // We're not incrementing keys to 2
      assert.equal(keychain.keys.length, 1);
    });

    it('should save key in memory options', () => {
      const keychain = new saito.keychain(app);
      keychain.addKey();

      assert.equal(app.options.keys[0], keychain.keys[0]);
    });

    it('should save keys in local options file', () => {
      const keychain = new saito.keychain(app);
      const newpubkey = app.crypto.returnPublicKey(app.crypto.generateKeys());

      keychain.addKey(newpubkey);

      let optionsfile = fs.readFileSync(`${__dirname}/../lib/options`, 'utf8');
      let newoptions = JSON.parse(optionsfile);

      assert.deepEqual(newoptions.keys[1], keychain.keys[1]);
    });
  });

  describe('encryptMessage', () => {
    it('should encrypt message using a key found via a public key', () => {
      const keychain    = new saito.keychain(app);
      const newpubkey = app.crypto.returnPublicKey(app.crypto.generateKeys());
      keychain.addKey(newpubkey);
      keychain.initializeKeyExchange();

      var encrypt_msg = keychain.encryptMessage(newpubkey, "test message");
      assert.isString(encrypt_msg);
    });
  });

  describe('decryptMessage', () => {
    it('should decrypt a message using the shared AES secret', () => {
      const keychain    = new saito.keychain(app);
      const newpubkey = app.crypto.returnPublicKey(app.crypto.generateKeys());
      keychain.addKey(newpubkey);
      keychain.initializeKeyExchange();

      var encrypt_msg = keychain.encryptMessage(newpubkey, "test message");
      var decrypt_msg = keychain.decryptMessage(newpubkey, encrypt_msg);
      assert.equal(decrypt_msg, "test message");
    });
  });

  describe('findByPublicKey', () => {
    it('should find key using the public key', () => {
      const keychain    = new saito.keychain(app);
      const newpubkey = app.crypto.returnPublicKey(app.crypto.generateKeys());
      keychain.addKey(newpubkey);

      var returned_key = keychain.findByPublicKey(newpubkey);
      assert.equal(returned_key.publickey, newpubkey);
    });

  });

  describe('findByIdentifier', () => {
    it('should find key using an identifier', () => {
      const keychain    = new saito.keychain(app);
      const newpubkey = app.crypto.returnPublicKey(app.crypto.generateKeys());
      keychain.addKey(newpubkey, "testID");

      var returned_key = keychain.findByIdentifier("testID");
      assert.equal(returned_key.publickey, newpubkey);
    });
  });

});