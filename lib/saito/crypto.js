'use strict'

const crypto            = require('crypto-browserify');
const sha256            = require('sha256');
const merkle            = require('merkle-tree-gen');
const node_cryptojs     = require('node-cryptojs-aes');
const { randomBytes }   = require('crypto');
const secp256k1         = require('secp256k1')
const CryptoJS          = node_cryptojs.CryptoJS;
const JsonFormatter     = node_cryptojs.JsonFormatter;
const Base58            = require("base-58");



/**
 * Crypto Constructor
 */
function Crypto() {
  if (!(this instanceof Crypto)) { return new Crypto(); }
  return this;
}
module.exports = Crypto;




///////////////////////////////////
// BASIC CRYPTOGRAPHIC FUNCTIONS //
///////////////////////////////////

/**
 * Hashes a string 2x sha256 like bitcoin
 * @param {string} text
 * @returns {string} 2x sha256 hash
 */
Crypto.prototype.hash = function hash(text="") {
  return sha256(sha256(text));
}




///////////////////////////////////
// ELLIPTICAL CURVE CRYPTOGRAPHY //
///////////////////////////////////

/**
 * Compresses public key
 *
 * @param {string} pubkey
 * @returns {string} compressed publickey
 */
Crypto.prototype.compressPublicKey = function compressPublicKey(pubkey) {
  return this.toBase58(secp256k1.publicKeyConvert(Buffer.from(pubkey,'hex'), true).toString('hex'));
}


/**
 * Converts base58 string to hex string
 *
 * @param {string} t string to convert
 * @returns {string} converted string
 */
Crypto.prototype.fromBase58 = function fromBase58(t) {
  return Buffer.from(Base58.decode(t), 'Uint8Array').toString('hex');
}


/**
 * Converts hex string to base58 string
 *
 * @param {string} t string to convert
 * @returns {string} converted string
 */
Crypto.prototype.toBase58 = function toBase58(t) {
  return Base58.encode(new Buffer(t, 'hex'));
}


/**
 * Creates a public/private keypair. returns the string
 * of the private key from which the public key can be
 * re-generated.
 * @returns {string} private key
 */
Crypto.prototype.generateKeys = function generateKeys() {
  let privateKey;
  do { privateKey = randomBytes(32) } while (!secp256k1.privateKeyVerify(privateKey, false))
  return privateKey.toString('hex');
}


/**
 * Returns the public key associated with a private key
 * @param {string} privkey private key (hex)
 * @returns {string} public key (hex)
 */
Crypto.prototype.returnPublicKey = function returnPublicKey(privkey) {
  return this.compressPublicKey(secp256k1.publicKeyCreate(Buffer.from(privkey,'hex'), false).toString('hex'));
}


/**
 * Signs a message with a private key, and returns the message
 * @param {string} msg message to sign
 * @param {string} privkey private key (hex)
 * @returns {string} base-58 signed message
 */
Crypto.prototype.signMessage = function signMessage(msg, privkey) {
  return this.toBase58(secp256k1.sign(Buffer.from(this.hash(Buffer.from(msg, 'utf-8').toString('base64')),'hex'), Buffer.from(privkey,'hex')).signature.toString('hex'));
}


/**
 * Returns an uncompressed public key from publickey
 * @param {string} pubkey public key (base-58)
 * @returns {string} public key (hex)
 */
Crypto.prototype.uncompressPublicKey = function uncompressPublicKey(pubkey) {
  return secp256k1.publicKeyConvert(Buffer.from(this.fromBase58(pubkey),'hex'), false).toString('hex');
}


/**
 * Confirms that a message was signed by the private
 * key associated with a providded public key
 * @param {string} msg
 * @param {string} sig
 * @param {string} pubkey
 * @returns {boolean} is signature valid?
 */
Crypto.prototype.verifyMessage = function verifyMessage(msg, sig, pubkey) {
  try {
    return secp256k1.verify(Buffer.from(this.hash(Buffer.from(msg, 'utf-8').toString('base64')),'hex'), Buffer.from(this.fromBase58(sig),'hex'), Buffer.from(this.uncompressPublicKey(pubkey),'hex'));
  } catch (err) {
    console.log(err);
    return false;
  }
}


/**
 * Checks if a publickey passed into a function
 * fits the criteria for a publickey
 * @param {string} publickey
 * @returns {boolean} does publickey fit the criteria?
 */
Crypto.prototype.isPublicKey = function isPublicKey(publickey) {
  if (publickey.length == 44 || publickey.length == 45) {
    if (publickey.indexOf("@") > 0) {} else {
      return 1;
    }
  }
  return 0;
}




//////////////////
// MERKLE TREES //
//////////////////

/**
 * Takes an array of strings and converts them into a merkle tree
 * of SHA256 hashes.
 * @param {array} inarray array of strings
 * @returns {merkle-tree}
 */
Crypto.prototype.returnMerkleTree = function returnMerkleTree(inarray) {
  var mt   = null;
  var args = { array: inarray, hashalgo: 'sha256', hashlist: false };
  merkle.fromArray(args, function (err, tree) { mt = tree; });
  return mt;
}







////////////////////
// DIFFIE HELLMAN //
////////////////////
//
// The DiffieHellman process allows two people to generate a shared
// secret in an environment where all information exchanged between
// the two can be observed by others.
//
// It is used by our encryption module to generate shared secrets,
// but is generally useful enough that we include it in our core
// cryptography class
//
// see the "encryption" module for an example of how to generate
// a shared secret using these functions
//


/**
 * Creates DiffieHellman object
 * @param {string} pubkey public key
 * @param {string} privkey private key
 * @returns {DiffieHellman object} ecdh
 */
Crypto.prototype.createDiffieHellman = function createDiffieHellman(pubkey="",privkey="") {
  var ecdh   = crypto.createECDH("secp256k1");
  ecdh.generateKeys();
  if (pubkey != "")  { ecdh.setPublicKey(pubkey); }
  if (privkey != "") { ecdh.setPrivateKey(privkey); }
  return ecdh;
}


/**
 * Given a Diffie-Hellman object, fetch the keys
 * @param {DiffieHellman object} dh Diffie-Hellamn object
 * @returns {{pubkey:"", privkey:""}} object with keys
 */
Crypto.prototype.returnDiffieHellmanKeys = function returnDiffieHellmanKeys(dh) {
  var keys = {};
  keys.pubkey  = dh.getPublicKey(null, "compressed");
  keys.privkey = dh.getPrivateKey(null, "compressed");
  return keys;
}


/**
 * Given your private key and your counterparty's public
 * key and an extra piece of information, you can generate
 * a shared secret.
 *
 * @param {DiffieHellman object} counterparty DH
 * @param {string} my_publickey
 *
 * @return {{pubkey:"", privkey:""}} object with keys
 */
Crypto.prototype.createDiffieHellmanSecret = function createDiffieHellmanSecret(a_dh, b_pubkey) {
  return a_dh.computeSecret(b_pubkey);
}








////////////////////////////////
// AES SYMMETRICAL ENCRYPTION //
////////////////////////////////
//
// once we have a shared secret (possibly generated through the
// Diffie-Hellman method above), we can use it to encrypt and
// decrypt communications using a symmetrical encryption method
// like AES.
//


/**
 * Encrypts with AES
 * @param {string} msg msg to encrypt
 * @param {string} secret shared secret
 * @returns {string} json object
 */
Crypto.prototype.aesEncrypt = function aesEncrypt(msg, secret) {
  var rp = new Buffer(secret.toString("hex"), "hex").toString("base64");
  var en = CryptoJS.AES.encrypt(msg, rp, { format: JsonFormatter });
  return en.toString();
}


/**
 * Decrypt with AES
 * @param {string} msg encrypted json object from aesEncrypt
 * @param {string} secret shared secret
 * @returns {string} unencrypted string
 */
Crypto.prototype.aesDecrypt = function aesDecrypt(msg, secret) {
  var rp = new Buffer(secret.toString("hex"), "hex").toString("base64");
  var de = CryptoJS.AES.decrypt(msg, rp, { format: JsonFormatter });
  return CryptoJS.enc.Utf8.stringify(de);
}

