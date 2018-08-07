'use strict';

const saito = require('../saito');
const Big      = require('big.js');


/**
 * Mempool Constructor
 * @param {*} app
 */
function Wallet(app) {

  if (!(this instanceof Wallet)) {
    return new Wallet(app);
  }

  this.app     = app || {};


  //////////////////
  // options vars //
  //////////////////
  this.wallet                     = {};
  this.wallet.balance             = "0.0";
  this.wallet.privatekey          = "";
  this.wallet.publickey           = "";
  this.wallet.identifier          = "";
  this.wallet.utxi                = [];
  this.wallet.utxo                = [];
  this.wallet.default_fee         = 2;
  this.wallet.version             = 2.05;


  // generate random keys
  this.wallet.privatekey = this.app.crypto.generateKeys();
  this.wallet.publickey  = this.app.crypto.returnPublicKey(this.wallet.privatekey);

}
module.exports = Wallet;


/**
 * Initialize Wallet
 */
Wallet.prototype.initialize = function initialize(app) {}


/**
 * Returns wallet balance
 * {returns} string publickey (hex)
 */
Wallet.prototype.returnBalance = function returnBalance() {
  return this.wallet.balance;
}

/**
 * Returns wallet publickey
 * {returns} string publickey (hex)
 */
Wallet.prototype.returnPublicKey = function returnPublicKey() {
  return this.wallet.publickey;
}

/**
 * Returns wallet privatekey
 * {returns} string privatekey (hex)
 */
Wallet.prototype.returnPrivateKey = function returnPrivateKey() {
  return this.wallet.privatekey;
}








