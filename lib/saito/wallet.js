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
  this.wallet                       = {};
  this.wallet.balance               = "0.0";
  this.wallet.privatekey            = "";
  this.wallet.publickey             = "";
  this.wallet.identifier            = "";
  this.wallet.inputs                = [];
  this.wallet.outputs               = [];
  this.wallet.spends                = [];
  this.wallet.default_fee           = 2;
  this.wallet.version               = 2.05;

  this.inputs_hmap                  = [];
  this.inputs_hmap_counter 	    = 0;
  this.inputs_hmap_counter_limit    = 10000;
  this.outputs_hmap                 = [];
  this.outputs_hmap_counter 	    = 0;
  this.outputs_hmap_counter_limit   = 10000;

  this.is_testing                   = false;
}
module.exports = Wallet;

/**
 * Initialize Wallet
 */
Wallet.prototype.initialize = function initialize(app) {


  if (this.wallet.privateKey == "") {

    ///////////////////
    // wallet exists //
    ///////////////////
    if (this.app.options.wallet != null) {

      //////////////////////////
      // reset if out-of-date //
      //////////////////////////
      //
      // we keep our public and private keys, but reset the
      // UTXI and UTXO data and force a clean reset of the
      // blockchain tracking information
      //
      if (this.app.options.wallet.version != this.wallet.version) {

        if (this.app.BROWSER == 1) {

          this.app.options.wallet.version = this.wallet.version;

          let tmpprivkey = this.app.options.wallet.privateKey;
          let tmppubkey = this.app.options.wallet.publicKey;
          let tmpid = this.app.options.wallet.identifier;

          // specify before reset to avoid archives reset problem
          this.wallet.publicKey = tmppubkey;
          this.wallet.privateKey = tmpprivkey;
          this.wallet.identifier = tmpid;

          // reset and save
          this.app.storage.resetOptions();
          this.app.storage.saveOptions();

          // re-specify after reset
          this.wallet.publicKey = tmppubkey;
          this.wallet.privateKey = tmpprivkey;
          this.wallet.identifier = tmpid;

          this.app.options.wallet = this.wallet;
          this.saveWallet();

	  //
	  // TODO: reimplement
	  //
          //this.app.archives.resetArchives();

          // reset blockchain
          this.app.options.blockchain.last_bid = "";
          this.app.options.blockchain.last_hash = "";
          this.app.options.blockchain.last_ts = "";

          alert("Saito Upgrade: Wallet Reset");

        }
      }
      this.wallet = this.app.options.wallet;
    }

    //////////////////////////
    // wallet doesn't exist //
    //////////////////////////
    if (this.wallet.privateKey == "") {
      // generate random keys
      this.wallet.privatekey            = this.app.crypto.generateKeys();
      this.wallet.publickey             = this.app.crypto.returnPublicKey(this.wallet.privatekey);
    }
  }


  //////////////////
  // import slips //
  //////////////////
  if (this.app.options.wallet != null) {
    if (this.app.options.wallet.inputs != null) {
      for (let i = 0; i < this.app.options.wallet.inputs.length; i++) {
        this.wallet.utxi[i] = new saito.slip(
          this.app.options.wallet.inputs[i].add,
          this.app.options.wallet.inputs[i].amt,
          this.app.options.wallet.inputs[i].type,
          this.app.options.wallet.inputs[i].bid,
          this.app.options.wallet.inputs[i].tid,
          this.app.options.wallet.inputs[i].sid,
          this.app.options.wallet.inputs[i].bhash,
          this.app.options.wallet.inputs[i].lc,
          this.app.options.wallet.inputs[i].rn
        );

        ////////////////////
        // update hashmap //
        ////////////////////
        let hmi = this.wallet.inputs[i].returnSlip();
        this.inputs_hmap[hmi] = 1;
        this.inputs_hmap_counter++;

      }
    }
    if (this.app.options.wallet.outputs != null) {
      for (let i = 0; i < this.app.options.wallet.outputs.length; i++) {
        this.wallet.outputs[i] = new saito.slip(
          this.app.options.wallet.outputs[i].add,
          this.app.options.wallet.outputs[i].amt,
          this.app.options.wallet.outputs[i].type,
          this.app.options.wallet.outputs[i].bid,
          this.app.options.wallet.outputs[i].tid,
          this.app.options.wallet.outputs[i].sid,
          this.app.options.wallet.outputs[i].bhash,
          this.app.options.wallet.outputs[i].lc,
          this.app.options.wallet.outputs[i].rn
        );


        ////////////////////
        // update hashmap //
        ////////////////////
        let hmi = this.wallet.outputs[i].returnSlip();
        this.outputs_hmap[hmi] = 1;
        this.outputs_hmap_counter++;

      }
    }
  }


  //
  // re-implement
  //
  //this.purgeExpiredSlips();

  this.updateBalance();
  this.saveWallet();

}


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
 * This function is triggered whenever we add a new block or 
 * undergo a chain reorganization which puts a new block at 
 * the tip of the chain. It is also triggered whenever we 
 * remove a block from the chain.
 *
 * @param {integer} block_id
 * @param {integer} block_hash
 * @param {integer} am_i_the_longest_chain
 */
//
// TODO - can we make these more efficient by referencing our hashmaps
// instead of looping through our inputs? These were originally separate
// functions that were individually called, but if we can make it efficient
// it may be easier cognitively for people to just run them this way.
//
// doing this may be more computationally intensive, but it will be easier
// for developers to understand, so perhaps it is a good idea to keep all
// of these in one place.
//
Wallet.prototype.onChainReorganization = function onChainReorganization(block_id, block_hash, lc) {

  if (lc == 1) {

    /////////////////////////
    // purge expired slips //
    /////////////////////////
    //
    // we have a new longest chain, which means we may have
    // some expired slips lingering around. purge them.
    //
    let gid = this.app.blockchain.returnGenesisBlockId();
    for (let m = this.wallet.inputs.length-1; m >= 0; m--) {
      if (this.wallet.inputs[m].bid < gid) {
        this.wallet.inputs.splice(m, 1);
        this.spends.splice(m, 1);
      }
    }
    for (let m = this.wallet.outputs.length-1; m >= 0; m--) {
      if (this.wallet.outputs[m].bid < gid) {
        this.wallet.outputs.splice(m, 1);
      }
    }


    ////////////////////////
    // reset spent inputs //
    ////////////////////////
    //
    // this means we have a new block, which means
    // that we can reset our SPEND array. TODO: make
    // this more sophisticated so that we wait a certain
    // number of blocks more than 1 before clearing the 
    // spend array.
    //
    for (let i = 0; i < this.wallet.inputs.length; i++) {
      if (this.spends[i] == 1) {
        this.spends[i] = 0;
      } else {
        i = this.wallet.inputs.length+2;
      }
    }

  }



  //////////////////////////
  // reset existing slips //
  //////////////////////////
  //
  // this is an edge case that may be unnecessary. if 
  // blocks receive their first block containing a payment
  // but they already have this payment indexed, we may
  // need to tell our wallet that all of those slips are
  // longest chain.
  //
  for (let m = this.wallet.inputs.length-1; m >= 0; m--) {
    if (this.wallet.inputs[m].bid == block_id) {
      this.wallet.inputs[m].lc = lc;
    }
    else {
      if (this.wallet.inputs[m].bid < block_id) {
        return;
      }
    }
  }

}


/**
 * Adds input to wallet.inputs
 * @param {saito.slip} input_slip
 */
Wallet.prototype.addInput = function addInput(x) {

  //////////////
  // add slip //
  //////////////
  //
  // we keep our slip array sorted according to block_id
  // so that we can (1) spend the earliest slips first,
  // and (2) simplify deleting expired slips
  //
  let pos = this.wallet.inputs.length;
  while (pos > 0 && this.wallet.inputs[pos-1].bid > x.bid) { pos--; }
  if (pos == -1) { pos = 0; }

  this.wallet.inputs.splice(pos, 0, x);
  this.spends.splice(pos, 0, 0);

  let hmi = this.returnIndex(x);
  this.inputs_hmap[hmi] = 1;
  this.inputs_hmap_counter++;


  ////////////////////////
  // regenerate hashmap //
  ////////////////////////
  //
  // we want to periodically re-generate our hashmaps
  // that help us check if inputs and outputs are already
  // in our wallet for memory-management reasons and
  // to maintain reasonable accuracy.
  //
  if (this.inputs_hmap_counter > this.inputs_hmap_counter_limit) {
    this.inputs_hmap = [];
    this.outputs_hmap = [];

    for (let i = 0; i < this.wallet.inputs.length; i++) {
      let hmi = this.wallet.inputs[i].returnIndex();
      this.inputs_hmap[hmi] = 1;
    }

    for (let i = 0; i < this.wallet.outputs.length; i++) {
      let hmi = this.wallet.outputs[i].returnIndex();
      this.outputs_hmap[hmi] = 1;
    }

  }
  return;
}


/**
 *
 * Adds a reference to a spent UTXO slip to our wallet.
 *
 * @param {saito.slip} output_slip
 *
 */
Wallet.prototype.addOutput = function addOutput(x) {

  if (this.is_testing) { return; }

  //////////////
  // add slip //
  //////////////
  //
  // we don't bother storing UTXO outputs in any specific
  // order as we more rarely need to search through them
  //
  this.wallet.outputs.push(x);

  let hmi = x.returnIndex();
  this.outputs_hmap[hmi] = 1;
  this.outputs_storage_counter++;


  ///////////////////////
  // purge old outputs //
  ///////////////////////
  //
  // delete excessive outputs to prevent options file expanding
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
Wallet.prototype.containsInput = function containsUtxi(s) {
  let hmi = s.returnIndex();
  if (this.inputs_hmap[hmi] == 1) { return true; }
  return false;
}


/**
 * Does our wallet contain a output slip?
 *
 * @param {saito.slip} slip
 * @returns {boolean}
 */
Wallet.prototype.containsOutput = function containsUtxo(s) {
  if (this.store_outputs == 0) { return false; }
  let hmi = s.returnIndex();
  if (this.outputs_hmap[hmi] == 1) { return true; }
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
Wallet.prototype.processPayment = function processPayment(blk, tx, to_slips, from_slips, lc) {

  //
  // if this is a speed test, delete all previous inputs
  // in order to avoid the software needing to iterate
  // through loops to check for duplicate inserts.
  //
  if (this.is_testing) {
    if (this.wallet.inputs.length > 0) {
      if (this.wallet.inputs[0].bid < blk.block.bid) {
        this.wallet.inputs = [];
      }
    }
  }

  //
  // inbound payments
  //
  if (slips.to.length > 0) {
    for (let m = 0; m < slips.to.length; m++) {

      if (slips.to[m].amt > 0) {

        //
        // Slip(add="", amt="0", type=0, bid=0, tid=0, sid=0, bhash="", lc=1, rn=-1) {
        //
        var s = new saito.slip(
          slips.to[m].add,
          slips.to[m].amt,
          slips.to[m].type,  
          blk.block.id,
          tx.transaction.id,
          slips.to[m].sid,
          blk.returnHash(),
          lc,
          slips.to[m].rn
        );


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
  if (this.is_testing) { return; }

  //
  // outbound payments
  //
  if (slips.from.length > 0) {
    for (var m = 0; m < slips.from.length; m++) {

      var s = slips.from[m];

      //
      // TODO: optimize search based on BID
      //
      for (var c = 0; c < this.wallet.inputs.length; c++) {
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



