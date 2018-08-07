'use strict';

const saito = require('../saito');
const Big      = require('big.js');


/////////////////
// Constructor //
/////////////////
function Wallet(app) {

  if (!(this instanceof Wallet)) {
    return new Wallet(app);
  }

  this.app     = app || {};

  //////////////////
  // options vars //
  //////////////////
  this.wallet                     = {};
  this.wallet.balance             = parseFloat(0.0);
  this.wallet.privateKey          = "";
  this.wallet.publicKey           = "";
  this.wallet.identifier          = "";
  this.wallet.utxi                = [];
  this.wallet.utxo                = [];
  this.wallet.default_fee         = 2;
  this.wallet.version             = 2.05;


  ///////////////
  // fast mode //
  ///////////////
  //
  // designed for speed tests on a single computer sending and
  // receiving transactions on a non-forking chain using spammer
  // module.
  //
  this.store_utxo                 = 0; // 1 = store utxo
  this.speed_test		              = 0; // trust all inputs


  /////////////
  // hashmap //
  /////////////
  //
  // Bitcoin refers generally to all slips as UTXO. In Saito 
  // we distinguish between UTXI (slips we have yet to spent
  // which are valid to spend) and UTXO (slips we have spent
  // which may or may not be valid for others to spend).
  //
  // We make this distinction mostly for ease for reference 
  // here in the wallet class.
  //
  // These hashmaps are used to speed up the process of 
  // checking whether inputs/outputs already exist. It is
  // possible for them to be inaccurate in that UTXI may 
  // be reported as existing which are already spent, but 
  // since we use them to check for duplicate inserts when
  // syncing the chain this is not a problem.
  //
  this.utxi_hashmap               = [];
  this.utxo_hashmap               = [];
  this.utxi_hashmap_counter 	  = 0;
  this.utxi_hashmap_counter_limit = 10000;


  /////////////////////////
  // UTXO storage limits //
  /////////////////////////
  //
  // we do not store all UTXO in perpetuity, as that would
  // cause our options file to expand out of control. And 
  // storing large amounts of UTXO makes it slower to add 
  // incoming UTXI and outgoing UTXO.
  //
  // these variables specify how many UTXO we keep in our
  // wallet before purging them. If there is a chain re-
  // organization and we have already discarded our UTXO
  // then the funds are lost.
  //
  this.utxo_storage_counter      = 0;
  this.utxo_storage_limit        = 1000; // keep only the last 1000 spent slips
  this.utxo_purged_bid           = 0;


  /////////////////
  // spent slips //
  /////////////////
  //
  // this tracks the UTXI that we have already spent this
  // block so that we do not attempt to use the same UTXI 
  // slip twice. It is reset after every block.
  //
  this.spent_slips               = [];
  this.spent_slips_idx           = 0;

  return this;

}
module.exports = Wallet;

Wallet.prototype.initialize = function initialize() {

  if (this.wallet.privateKey == "") {
    if (this.wallet.privateKey == "") {
      this.generateKeys();
    }
  }

}

Wallet.prototype.generateKeys = function generateKeys() {
  this.wallet.privateKey = this.app.crypt.generateKeys();
  this.wallet.publicKey  = this.app.crypt.returnPublicKey(this.wallet.privateKey);
}