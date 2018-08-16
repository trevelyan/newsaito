const saito = require('../saito');


/////////////////
// Constructor //
/////////////////
function Keychain(app) {

  if (!(this instanceof Keychain)) {
    return new Keychain(app);
  }

  this.app         = app || {};
  this.keys        = [];

  return this;

}
module.exports = Keychain;


/**
 * Initialize
 */
Keychain.prototype.initialize = function initialize() {

  if (this.app.options.keys == null) { this.app.options.keys = {}; }

  for (let i = 0; i < this.app.options.keys.length; i++) {

    var tk               = this.app.options.keys[i];

    var k                = new saito.key();
        k.publickey      = tk.publickey;
        k.watched        = tk.watched;
        k.aes_publickey  = tk.aes_publickey;
        k.aes_privatekey = tk.aes_privatekey;
        k.aes_secret     = tk.aes_secret;
        k.identifiers    = [];
        k.tags           = [];

    for (let m = 0; m < tk.identifiers.length; m++) {
      k.identifiers[m] = tk.identifiers[m];
    }
    for (let m = 0; m < tk.tags.length; m++) {
      k.tags[m] = tk.tags[m];
    }
    this.keys.push(k);
  }

}



/**
 * Adds keys and identifiers to Keychain, and allows keys to be upgraded to "watched" status
 *
 * @param {string} publickey
 * @param {string} identifier
 * @param {boolean} watched
 * @param {string} tag
 */
Keychain.prototype.addKey = function addKey(publickey, identifier = "", watched = false, tag = "") {

  if (publickey == "") { return; }

  let tmpkey = this.findByPublicKey(publickey);
  if (tmpkey == null) {
    tmpkey                = new saito.key();
    tmpkey.publickey      = publickey;
    tmpkey.watched        = watched;
    if (identifier != "") { tmpkey.addIdentifier(identifier); }
    if (tag != "")        { tmpkey.addTag(tag); }
    this.keys.push(tmpkey);
  } else {
    if (identifier != "") { tmpkey.addIdentifier(identifier); }
    if (tag != "")        { tmpkey.addTag(tag); }
    if (watched)          { tmpkey.watched = true; }
  }
  this.saveKeys();
}


/**
 * Decrypts a message provided there is a shared secret for the associated public key
 *
 * @param {string} publickey
 * @param {string} msg
 * @return {string} msg
 */
Keychain.prototype.decryptMessage = function decryptMessage(publickey, encrypted_msg) {

  // submit JSON parsed object after unencryption
  for (let x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey) {
      if (this.keys[x].aes_secret != "") {
        var tmpmsg = this.app.crypto.aesDecrypt(encrypted_msg, this.keys[x].aes_secret);
        if (tmpmsg != null) {
          var tmpx = JSON.parse(tmpmsg);
          if (tmpx.module != null) {
            return JSON.parse(tmpmsg);
          }
        }
      }
    }
  }

  // or return original
  return encrypted_msg;
}


/**
 * Decrypts a string if there exists a shared secret for the associated public key
 *
 * @param {string} publickey
 * @param {string} msg
 */
Keychain.prototype.decryptString = function decryptString(publickey, encrypted_string) {

  // submit JSON parsed object after unencryption
  for (let x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey) {
      if (this.keys[x].aes_secret != "") {
        var tmpmsg = this.app.crypto.aesDecrypt(encrypted_string, this.keys[x].aes_secret);
        return tmpmsg;
      }
    }
  }

  // or return the original
  return encrypted_string;
}


/**
 * Encrypts a message if a shared secret exists for the associated public key.
 *
 * @param {string} publickey
 * @param {string} msg
 */
Keychain.prototype.encryptMessage = function encryptMessage(publickey, msg) {

  // turn submitted msg object into JSON and then encrypt it, or
  // return the original unencrypted object
  var jsonmsg = JSON.stringify(msg);

  for (let x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey) {
      if (this.keys[x].aes_secret != "") {
        return this.app.crypto.aesEncrypt(jsonmsg, this.keys[x].aes_secret);
      }
    }
  }

  return msg;
}


/**
 * Return the key associated with this public key
 *
 * @param {string} publickey
 */
Keychain.prototype.findByPublicKey = function findByPublicKey(publickey) {
  for (let x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey) { return this.keys[x]; }
  }
  return null;
}


/**
 * Returns the key associated with the identifier, or null
 *
 * @param {string} identifier
 * @return {saito.key} key found by identifier
 */
Keychain.prototype.findByIdentifier = function findByIdentifier(identifier) {
  for (let x = 0; x < this.keys.length; x++) {
    if (this.keys[x].isIdentifier(identifier) == 1) { return this.keys[x]; }
  }
  return null;
}


/**
 * Returns 1 if we have a shared secret with this public key
 *
 * @param {string} publickey
 * @return {boolean}
 */
Keychain.prototype.hasSharedSecret = function hasSharedSecret(publickey) {
  for (let x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey || this.keys[x].isIdentifier(publickey) == 1) {
      if (this.keys[x].hasSharedSecret() == 1) {
        return true;
      }
    }
  }
  return false;
}



/**
 * Returns true if we are watching this key
 *
 * @param {string} publickey
 * @return {boolean} is key watched?
 */
Keychain.prototype.isWatched = function isWatched(publickey) {
  for (let x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey || this.keys[x].isIdentifier(publickey)) {
      if (this.keys[x].isWatched()) {
        return true;
      }
    }
  }
  return false;
}


/**
 * Return publickey of alice in key exchange Diffie-Helman
 *
 * @param {string} publickey
 * @return {string} publickey
 */
Keychain.prototype.initializeKeyExchange = function initializeKeyExchange(publickey) {

  var alice            = this.app.crypto.createDiffieHellman();
  var alice_publickey  = alice.getPublicKey(null, "compressed").toString("hex");
  var alice_privatekey = alice.getPrivateKey(null, "compressed").toString("hex");
  this.updateCryptoByPublicKey(publickey, alice_publickey, alice_privatekey, "");
  return alice_publickey;

}


/**
 * Returns true if key found by publickey is tagged
 *
 * @param {string} publickey
 * @param {string} tag
 * @return {boolean} is tagged
 */
Keychain.prototype.isTagged = function isTagged(publickey, tag) {
  var x = this.findByPublicKey(publickey);
  if (x == null) { return false; }
  return x.isTagged(tag);
}


/**
 * saves keys into options file
 */
Keychain.prototype.saveKeys = function saveKeys() {
  this.app.options.keys = this.keys;
  this.app.storage.saveOptions();
}


/**
 * Remove key from array of keys
 *
 * @param {string} publickey
 */
Keychain.prototype.removeKey = function removeKey(publickey) {
  for (let x = this.keys.length-1; x >= 0; x--) {
    if (this.keys[x].publickey == publickey) {
      this.keys.splice(x, 1);
    }
  }
}


/**
 * Remove key from array of keys by identifier and tag
 *
 * @param {string} identifier
 * @param {string} tag
 */
Keychain.prototype.removeKeyByIdentifierAndKeyword = function removeKeywordByIdentifierAndKeyword(identifier, tag) {
  for (let x = this.keys.length-1; x >= 0; x--) {
    if (this.keys[x].isIdentifier(identifier) && this.keys[x].isTagged(tag)) {
      this.removeKey(this.keys[x].publickey);
      return;
    }
  }
}


/**
 * Remove key from array of keys by identifier and tag
 *
 * @param {string} tag
 * @return {array} keychain
 */
Keychain.prototype.returnKeychainByTag = function returnKeychainByTag(tag) {
  var kx = [];
  for (let x = 0; x < this.keys.length; x++) {
    if (this.keys[x].isTagged(tag)) { kx[kx.length] = this.keys[x]; }
  }
  return kx;
}


/**
 * Returns keys
 *
 * @return {saito.keys} key array
 */
Keychain.prototype.returnKeychain = function returnKeychain() {
  return this.keys;
}


/**
 * Return public key by identifier
 *
 * @param {string} identifier
 */
Keychain.prototype.returnPublicKeyByIdentifier = function returnPublicKeyByIdentifier(identifier) {
  for (let x = 0; x < this.keys.length; x++) {
    if (this.keys[x].isIdentifier(identifier)) { return this.keys[x].publickey; }
  }
  return "";
}


/**
 * Returns the public keys we are watching
 *
 * @returns {array} public keys
 */
Keychain.prototype.returnWatchedPublicKeys = function returnWatchedPublicKeys() {
  var x = [];
  for (let i = 0; i < this.keys.length; i++) {
    if (this.keys[i].isWatched()) {
      x.push(this.keys[i].publickey);
    }
  }
  return x;
}


/**
 * Update the pubkey / privkey / aes secret by publickey
 *
 * @param {string} publickey
 * @param {string} aes_publickey
 * @param {string} aes_privatekey
 * @param {string} shared_secret
 */
Keychain.prototype.updateCryptoByPublicKey = function updateCryptoByPublicKey(publickey, aes_publickey = "", aes_privatekey = "", shared_secret = "") {

  if (publickey == "") { return; }

  this.addKey(publickey);

  for (let x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey) {
      this.keys[x].aes_publickey  = aes_publickey;
      this.keys[x].aes_privatekey = aes_privatekey;
      this.keys[x].aes_secret     = shared_secret;
    }
  }

  this.saveKeys();

  return true;
}

