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

  // options vars
  this.wallet                     = {};
  this.wallet.balance             = "0.0";
  this.wallet.privatekey          = "";
  this.wallet.publickey           = "";
  this.wallet.identifier          = "";
  this.wallet.inputs              = [];
  this.wallet.outputs             = [];
  this.wallet.spends              = [];
  this.wallet.default_fee         = 2;
  this.wallet.version             = 2.05;

  this.inputs_hashmap               = [];
  this.outputs_hashmap              = [];
  this.inputs_hashmap_counter 	    = 0;
  this.inputs_hashmap_counter_limit = 10000;

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
 * @returns {string} publickey (hex)
 */
Wallet.prototype.returnBalance = function returnBalance() {
  return this.wallet.balance;
}

/**
 * Returns wallet publickey
 * @returns {string} publickey (hex)
 */
Wallet.prototype.returnPublicKey = function returnPublicKey() {
  return this.wallet.publickey;
}

/**
 * Returns wallet privatekey
 * @returns {string} privatekey (hex)
 */
Wallet.prototype.returnPrivateKey = function returnPrivateKey() {
  return this.wallet.privatekey;
}

/**
 * Remove UTXI slips from our wallet that can no longer
 * be spent because they have fallen off the transient
 * blockchain.
 */
Wallet.prototype.purgeExpiredSlips = function purgeExpiredSlips() {
  let gid = this.app.blockchain.returnGenesisBlockId();
  if (gid <= this.utxo_purged_bid) { return; }
  for (let m = this.wallet.inputs.length-1; m >= 0; m--) {
    if (this.wallet.inputs[m].bid < gid) {
      this.wallet.inputs.splice(m, 1);
      this.spent_slips.splice(m, 1);
    }
  }
  for (let m = this.wallet.outputs.length-1; m >= 0; m--) {
    if (this.wallet.outputs[m].bid < gid) {
      this.wallet.outputs.splice(m, 1);
    }
  }
  this.outputs_purged_bid = gid;
}


/**
 * This function is triggered whenever the blockchain
 * undergoes a reorganization. we go through our set of
 * utxi and update our list of which ones are spendable.
 *
 * @param {integer} block_id
 * @param {integer} block_hash
 * @param {integer} am_i_the_longest_chain
 */
Wallet.prototype.onChainReorganization = function onChainReorganization(block_id, block_hash, lc) {}


/**
 * Adds input to wallet.inputs
 * @param {saito.slip} input_slip
 */
Wallet.prototype.addInput = function addInput(x) {

  //////////////
  // add slip //
  //////////////
  //
  // we keep our UTXI array sorted according to block_id
  // so that we can (1) spend the earliest slips first,
  // and (2) simplify deleting expired slips
  //
  let pos = this.wallet.inputs.length;
  while (pos > 0 && this.wallet.inputs[pos-1].bid > x.bid) { pos--; }
  if (pos == -1) { pos = 0; }

  this.wallet.inputs.splice(pos, 0, x);
  this.spent_slips.splice(pos, 0, 0);

  let hmi = this.returnIndex(x);
  this.inputs_hashmap[hmi] = 1;
  this.inputs_hashmap_counter++;


  ////////////////////////
  // regenerate hashmap //
  ////////////////////////
  //
  // we want to periodically re-generate our hashmaps
  // that help us check if inputs and UTXO are already
  // in our wallet for memory-management reasons and
  // to maintain reasonable accuracy.
  //
  if (this.inputs_hashmap_counter > this.inputs_hashmap_counter_limit) {
    this.inputs_hashmap = [];
    this.outputs_hashmap = [];

    for (let i = 0; i < this.wallet.inputs.length; i++) {
      let hmi = this.returnHashmapIndex(this.wallet.inputs[i]);
      this.inputs_hashmap[hmi] = 1;
    }
    for (let i = 0; i < this.wallet.outputs.length; i++) {
      let hmi = this.returnHashmapIndex(this.wallet.outputs[i]);
      this.outputs_hashmap[hmi] = 1;
    }
  }
  return;
}

/////////////
// addUTXO //
/////////////
/**
 *
 * Adds a UTXO slip to our wallet.
 *
 * @param {saito.slip} output_slip
 *
 */
Wallet.prototype.addOutput = function addOutput(x) {

  if (this.store_utxo == 0) { return; }

  //////////////
  // add slip //
  //////////////
  //
  // we don't bother storing UTXO outputs in any specific
  // order as we more rarely need to search through them
  //
  this.wallet.output.push(x);

  let hmi = this.returnHashmapIndex(x);
  this.output_hashmap[hmi] = 1;
  this.output_storage_counter++;


  ////////////////////
  // purge old output //
  ////////////////////
  //
  // delete excessive output inputs to prevent options file expanding
  // uncontrollably. the downside is the potential for funds loss
  // with chain-reorganizations
  //
  if (this.output_storage_counter >= this.output_storage_limit) {
    console.log("Deleting Excessive outputs from heavy-spend wallet...");
    this.wallet.output.splice(0, this.wallet.output.length-this.output_storage_limit);
    this.output_storage_counter = 0;
  }
  return;
}

/**
 * Does our wallet contain an input slip?
 *
 * @param {saito.slip} slip
 * @returns {boolean}
 */
Wallet.prototype.containsInputs = function containsUtxi(s) {
  let hmi = s.returnIndex();

  if (this.inputs_hashmap[hmi] == 1) { return true; }

  return false;
}

/**
 * Does our wallet contain a output slip?
 *
 * @param {saito.slip} slip
 * @returns {boolean}
 */
Wallet.prototype.containsOutputs = function containsUtxo(s) {
  if (this.store_outputs == 0) { return false; }

  let hmi = s.returnIndex();
  if (this.outputs_hashmap[hmi] == 1) { return true; }

  return false;
}

/**
 * This is triggered (by the blockchain object) whenever we
 * receive a block that has a transaction to or from us. we
 * check to make sure we have not already processed it, as
 * sometimes that can happen if we are resyncing the chain,
 * and if we have not we add it to our UTXI or UTXO stores.
 *
 * note that this function needs to keep track of whether this
 * block is part of the longest chain in order to know whether
 * our wallet has received spendable money.
 *
 * @param {saito.block} blk
 * @param {saito.transaction} tx
 * @param {integer} lchain
 */
Wallet.prototype.paymentConfirmation = function paymentConfirmation(blk, tx, lchain) {

  //
  // if this is a speed test, delete all previous inputs
  // in order to avoid the software needing to iterate
  // through loops to check for duplicate inserts.
  //
  if (this.speed_test == 1) {
    if (this.wallet.inputs.length > 0) {
      if (this.wallet.inputs[0].bid < blk.block.bid) {
        this.wallet.inputs = [];
      }
    }
  }

  //
  // inbound payments
  //
  let slips = tx.returnSlipsTo(this.returnPublicKey());

  if (slips.length > 0) {
    for (let m = 0; m < slips.length; m++) {

      var s       = new saito.slip(slips[m].add, slips[m].amt, slips[m].gt);
          s.bhash = blk.returnHash();
          s.bid   = blk.block.id;
          s.tid   = tx.transaction.id;
          s.sid   = slips[m].sid;
          s.lc    = lchain;
	  s.ft    = slips[m].ft;
	  s.rn    = slips[m].rn;

      if (s.amt > 0) {

        //
	// if we are testing speed inserts, just
	// push to the back of the UTXI chain without
	// verifying anything
	//
	// this should not be run in production code
	// but lets us minimize wallet checks taking
	// up significant time during capacity tests
	// on other network code.
	//
	if (this.speed_test == 1) {
	  this.addInput(s);
	} else {
          if (this.containsInput(s) == 0) {
	    if (this.containsOutput(s) == 0) {
	      this.addInput(s);
            }
          }
        }
      }
    }
  }

  // don't care about UTXO in speed tests
  if (this.speed_tests == 1) { return; }

  //
  // outbound payments
  //
  var slips = tx.returnSlipsFrom(this.returnPublicKey());

  if ((slips.length > 0) && tx.transaction.gt == null) {
    for (var m = 0; m < slips.length; m++) {
      var s = slips[m];
      for (var c = 0; c < this.wallet.utxi.length; c++) {
        var qs = this.wallet.utxi[c];
        if (
	  s.bid   == qs.bid &&
	  s.tid   == qs.tid &&
	  s.sid   == qs.sid &&
	  s.bhash == qs.bhash &&
	  s.amt   == qs.amt &&
	  s.add   == qs.add &&
	  s.rn    == qs.rn
	) {
          if (this.containsOutput(s) == 0) {
	    this.addOutput(this.wallet.inputs[c]);
          }
	  this.wallet.inputs.splice(c, 1);
	  this.spent_slips.splice(c, 1);
	  c = this.wallet.inputs.length+2;
	}
      }
    }
  }
}
