'use strict'

const crypt             = exports;
const crypto            = require('crypto-browserify');
const sha256            = require('sha256');
const merkle            = require('merkle-tree-gen');
const node_cryptojs     = require('node-cryptojs-aes');
const { randomBytes }   = require('crypto');
const secp256k1         = require('secp256k1')
const CryptoJS          = node_cryptojs.CryptoJS;
const JsonFormatter     = node_cryptojs.JsonFormatter;
const Base58            = require("base-58");


/////////////////
// CONSTRUCTOR //
/////////////////
function Crypt() {
  if (!(this instanceof Crypt)) { return new Crypt(); }
  return this;
}
module.exports = Crypt;




///////////////////////////////////
// BASIC CRYPTOGRAPHIC FUNCTIONS //
///////////////////////////////////

//////////
// hash //
//////////
//
// hashes a string. 2x sha256 like bitcoin
//
// @params {string} tstring to hash
// @returns {string} hash of string
//
Crypt.prototype.hash = function hash(text) { 
  return sha256(sha256(text));
}




///////////////////////////////////
// ELLIPTICAL CURVE CRYPTOGRAPHY //
///////////////////////////////////

///////////////////////
// compressPublicKey //
///////////////////////
//
// compresses public key
//
// @params {string} publickey
// @returns {string} compressed publickey
//
Crypt.prototype.compressPublicKey = function compressPublicKey(pubkey) {
  return this.toBase58(secp256k1.publicKeyConvert(Buffer.from(pubkey,'hex'), true).toString('hex'));
}


////////////////
// fromBase58 //
////////////////
//
// converts base58 string to hex string
//
// @params {string} string to convert
// @returns {string} converted string
//
Crypt.prototype.fromBase58 = function fromBase58(t) {
  return Buffer.from(Base58.decode(t), 'Uint8Array').toString('hex');
}


//////////////
// toBase58 //
//////////////
//
// converts hex string to base58 string
//
// @params {string} string to convert
// @returns {string} converted string
//
Crypt.prototype.toBase58 = function toBase58(t) {
  return Base58.encode(new Buffer(t, 'hex'));
}


//////////////////
// generateKeys //
//////////////////
//
// creates a public/private keypair. returns the string
// of the private key from which the public key can be
// re-generated.
//
// @returns {string} private key
//
Crypt.prototype.generateKeys = function generateKeys() {
  let privateKey;
  do { privateKey = randomBytes(32) } while (!secp256k1.privateKeyVerify(privateKey, false))
  return privateKey.toString('hex');
}


/////////////////////
// returnPublicKey //
/////////////////////
//
// returns the public key associated with a private key
//
// @params {string} private key (hex)
// @returns {string} public key (hex)
//
Crypt.prototype.returnPublicKey = function returnPublicKey(privkey) {
  return this.compressPublicKey(secp256k1.publicKeyCreate(Buffer.from(privkey,'hex'), false).toString('hex'));
}


/////////////////
// signMessage //
/////////////////
//
// signs a message with a private key, returns it
//
// @params {string} message to sign
// @params {string} private key (hex)
// @returns {string} base-58 signed message
//
Crypt.prototype.signMessage = function signMessage(msg, privkey) {
  return this.toBase58(secp256k1.sign(Buffer.from(this.hash(Buffer.from(msg, 'utf-8').toString('base64')),'hex'), Buffer.from(privkey,'hex')).signature.toString('hex'));
}


/////////////////////////
// uncompressPublicKey //
/////////////////////////
//
// returns an uncompressed public key
//
// @params {string} public key (base-58)
// @returns {string} public key (hex)
//
Crypt.prototype.uncompressPublicKey = function uncompressPublicKey(pubkey) {
  return secp256k1.publicKeyConvert(Buffer.from(this.fromBase58(pubkey),'hex'), false).toString('hex');
}


///////////////////
// verifyMessage //
///////////////////
//
// confirms that a message was signed by the private
// key associated with a provided public key
//
// @params {string} message to check
// @params {string} signature to confirm
// @params {string} public key of alleged signer
// @returns {boolean} is signature valid?
//
Crypt.prototype.verifyMessage = function verifyMessage(msg, sig, pubkey) {
  try {
  return secp256k1.verify(Buffer.from(this.hash(Buffer.from(msg, 'utf-8').toString('base64')),'hex'), Buffer.from(this.fromBase58(sig),'hex'), Buffer.from(this.uncompressPublicKey(pubkey),'hex'));
  } catch (err) { 
    return false; 
  }
}


/////////////////
// isPublicKey //
/////////////////
//
// finds out if we have a public key
//
// @params {string} publickey?
//
Crypt.prototype.isPublicKey = function isPublicKey(publickey) {
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

//////////////////////
// returnMerkleTree //
//////////////////////
//
// takes an array of strings and converts them into a merkle tree
// of SHA256 hashes.
//
// @params {array} array of strings
// @returns {merkle-tree}
//
Crypt.prototype.returnMerkleTree = function returnMerkleTree(inarray) {
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

/////////////////////////
// createDiffieHellman //
/////////////////////////
//
// @params {string} public key
// @params {string} private key
// @returns {DiffieHellman object} ecdh
//  
Crypt.prototype.createDiffieHellman = function createDiffieHellman(pubkey="",privkey="") {
  var ecdh   = crypto.createECDH("secp256k1");
  ecdh.generateKeys();
  if (pubkey != "")  { ecdh.setPublicKey(pubkey); }
  if (privkey != "") { ecdh.setPrivateKey(privkey); }
  return ecdh;
}


//////////////////////////////
// returnDiffieHellmanKeys //
/////////////////////////////
//
// Given a Diffie-Hellman object, fetch the keys
//
// @params {DiffieHellman object} dh
// @returns {{pubkey:"",privkey:""}} object with keys
//
Crypt.prototype.returnDiffieHellmanKeys = function returnDiffieHellmanKeys(dh) {
  var keys = {};
  keys.pubkey  = dh.getPublicKey(null, "compressed");
  keys.privkey = dh.getPrivateKey(null, "compressed");
  return keys;
}


///////////////////////////////
// createDiffieHellmanSecret //
//////////////////////////////
//
// Given your private key and your counterparty's public
// key and an extra piece of information, you can generate
// a shared secret.
//
// @params {DiffieHellman object} counterparty DH
// @params {string} my_publickey
//
// @returns {{pubkey:"",privkey:""}} object with keys
//
Crypt.prototype.createDiffieHellmanSecret = function createDiffieHellmanSecret(a_dh, b_pubkey) {
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

////////////////
// aesEncrypt //
////////////////
//
// @param {string} msg to encrypt
// @param {string} shared secret
// @returns {string} json object
//
Crypt.prototype.aesEncrypt = function aesEncrypt(msg, secret) {
  var rp = new Buffer(secret.toString("hex"), "hex").toString("base64");
  var en = CryptoJS.AES.encrypt(msg, rp, { format: JsonFormatter });
  return en.toString();
}

////////////////
// aesDecrypt //
////////////////
//
// @param {string} encrypted json object from aesEncrypt
// @param {string} shared secret
// @returns {string} unencrypted

Crypt.prototype.aesDecrypt = function aesDecrypt(msg, secret) {
  var rp = new Buffer(secret.toString("hex"), "hex").toString("base64");
  var de = CryptoJS.AES.decrypt(msg, rp, { format: JsonFormatter });
  return CryptoJS.enc.Utf8.stringify(de);
}

