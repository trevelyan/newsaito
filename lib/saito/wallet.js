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


  if (this.wallet.privatekey == "") {

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

          let tmpprivkey = this.app.options.wallet.privatekey;
          let tmppubkey = this.app.options.wallet.publickey;
          let tmpid = this.app.options.wallet.identifier;

          // specify before reset to avoid archives reset problem
          this.wallet.publickey = tmppubkey;
          this.wallet.privatekey = tmpprivkey;
          this.wallet.identifier = tmpid;

          // reset and save
          this.app.storage.resetOptions();
          this.app.storage.saveOptions();

          // re-specify after reset
          this.wallet.publickey = tmppubkey;
          this.wallet.privatekey = tmpprivkey;
          this.wallet.identifier = tmpid;

          this.app.options.wallet = this.wallet;
          this.saveWallet();

          //
          // TODO: reimplement resetting archives
          //
          this.app.archives.resetArchives();

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
    if (this.wallet.privatekey == "") {
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
        this.wallet.inputs[i] = new saito.slip(
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
        this.wallet.spends.push(0);

        ////////////////////
        // update hashmap //
        ////////////////////
        let hmi = this.wallet.inputs[i].returnIndex();
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
        let hmi = this.wallet.outputs[i].returnIndex();
        this.outputs_hmap[hmi] = 1;
        this.outputs_hmap_counter++;

      }
    }
    if (this.app.options.wallet.spends != null) {
      this.wallet.spends = this.app.options.wallet.spends;
    }
  }


  //
  // re-implement
  //
  this.purgeExpiredSlips();
  this.updateBalance();
  this.saveWallet();

}



/**
 * counts up the amount of SAITO tokens we have in our wallet
 * and returns that. If this function is provided with a decimal
 * indicating the limit, we stop and report the total value of
 * the UTXI slips we have sufficient to cover that limit.
 *
 * @param  {decimal} amount of tokens needed
 * @returns {decimal} value of tokens in wallet
 **/
Wallet.prototype.returnAvailableInputs = function returnAvailableInputs(limit=0) {

  var value   = Big(0.0);

  this.purgeExpiredSlips();
  // lowest acceptable block_id for security (+1 because is next block, +1 for safeguard)
  var lowest_block = this.app.blockchain.returnLatestBlockId() - this.app.blockchain.returnGenesisPeriod();
      lowest_block = lowest_block+2;

  // calculate value
  for (let i = 0; i < this.wallet.inputs.length; i++) {
    if (this.wallet.spends[i] == 0) {
      if (this.wallet.inputs[i].lc == 1 && this.wallet.inputs[i].bid >= lowest_block) {
        value = value.plus(Big(this.wallet.inputs[i].amt));
        if (value.gte(limit) && limit != 0) {
          return value.toFixed(8);
        }
      }
    }
  }

  return value.toFixed(8);

}



/**
 * create a transaction with the appropriate slips given
 * the desired fee and payment to associate with the
 * transaction, and a change address to receive any
 * surplus tokens.
 *
 * @param {string} recipient publickey
 * @param {decimal} payment amount
 * @param {decimal} fee to send with tx
 *
 * @returns {saito.transaction} if successful
 * @returns {null} if inadequate inputs
 **/
Wallet.prototype.createUnsignedTransaction = function createUnsignedTransaction(publickey, amt = 0.0, fee = 0.0) {

  var tx           = new saito.transaction();
  var total_fees   = Big(amt).plus(Big(fee));
  var wallet_avail = Big(this.returnBalance());

  if (total_fees.gt(wallet_avail)) {
    return null;
  }

  //
  // zero-fee transactions have fake inputs
  //
  if (total_fees == 0.0) {
    tx.transaction.from = [];
    tx.transaction.from.push(new saito.slip(this.returnPublicKey()));
  } else {
    tx.transaction.from = this.returnAdequateInputs(total_fees);
  }
  tx.transaction.ts   = new Date().getTime();
  tx.transaction.to.push(new saito.slip(publickey, amt));

  // specify that this is a normal transaction
  tx.transaction.to[tx.transaction.to.length-1].type = 0;
  if (tx.transaction.from == null) { return null; }

  // add change input
  var total_inputs = Big(0.0);
  for (let ii = 0; ii < tx.transaction.from.length; ii++) {
    total_inputs = total_inputs.plus(Big(tx.transaction.from[ii].amt));
  }

  var change_amount = total_inputs.minus(total_fees);
  if (Big(change_amount).gt(0)) {
    tx.transaction.to.push(new saito.slip(this.returnPublicKey(), change_amount.toFixed(8)));
    // specify that this is a normal transaction
    tx.transaction.to[tx.transaction.to.length-1].type = 0;
  }

  return tx;

}


/**
 * create a transaction with the appropriate slips given
 * the desired fee and payment to associate with the
 * transaction, and a change address to receive any
 * surplus tokens. Use the default wallet fee.
 *
 * @param {string} recipient publickey
 * @param {decimal} fee to send with tx
 *
 * @returns {saito.transaction} if successful
 * @returns {null} if inadequate inputs
 **/
Wallet.prototype.createUnsignedTransactionWithDefaultFee = function createUnsignedTransactionWithDefaultFee(publickey, amt = 0.0) {
  return this.createUnsignedTransaction(publickey, amt, this.returnDefaultFee());
}



/**
 * signs a transaction using the wallet private key.
 *
 * @param {saito.transaction} tx transaction to sign
 * @returns {saito.transaction} signed transaction
 **/
Wallet.prototype.signTransaction = function signTransaction(tx) {

  if (tx == null) { return null; }

  // ensure slip ids are properly sequential
  for (var i = 0; i < tx.transaction.to.length; i++) {
    tx.transaction.to[i].sid = i;
  }

  tx.transaction.msig   = this.signMessage(tx.returnMessageSignatureSource());
  tx.transaction.sig    = this.signMessage(tx.returnSignatureSource());
  return tx;
}


/**
 * signs a msg string using the wallet private key.
 *
 * @param {string} msg message to sign
 * @returns {string} public key
 **/
Wallet.prototype.signMessage = function signMessage(msg) {
  return saito.crypto().signMessage(msg, this.returnPrivateKey());
}


/**
 * create a special "fee transaction / fee ticket" that
 * can be included in a block by the node that created it
 * in order to collect the necessary fees. The node must
 * collect the funds at its own address for this tx to be
 * valid.
 *
 * @param {decimal} fee to collect
 *
 * @returns {saito.transaction} tx
 **/
Wallet.prototype.createFeeTransaction = function createFeeTransaction(my_fee) {

  var fslip = new saito.slip(this.returnPublicKey(), 0.0, 0);
  fslip.type = 1;

  var tx = new saito.transaction();
  tx.transaction.from.push(fslip);

  var tslip = new saito.slip(this.returnPublicKey(), Big(my_fee).toFixed(8), 0);
  tx.transaction.to.push(tslip);
  tx.transaction.ts  = new Date().getTime();

  tx = this.signTransaction(tx);

  return tx;

}



/**
 *
 * create a special "golden ticket transaction" that claims
 * the reward offered by a golden ticket. this function is
 * used by miners. the two UTXO slips are the winners of the
 * golden ticket.
 *
 * @param {array} winners winnning nodes
 * @param {object} solution golden ticket solution
 *
 * @returns {saito.transaction} tx
 **/
//
// TODO: -- needs to create based on addresses, not on precreated slips
//
Wallet.prototype.createGoldenTransaction = function createGoldenTransaction(winners, solution) {

  var tx = new saito.transaction();
  tx.transaction.from.push(new saito.slip(this.returnPublicKey(), 0.0, 1));

  tx.transaction.to.push(winners[0]);
  tx.transaction.to.push(winners[1]);
  tx.transaction.ts  = new Date().getTime();
  tx.transaction.gt  = solution;
  tx.transaction.msg = "golden ticket";

  tx = this.signTransaction(tx);

  return tx;

}






/**
 * given an amount of SAITO tokens, fetches an adequate number of
 * UTXI slips and returns them as part of an array. If there are
 * not enough tokens in the wallet, returns null.
 *
 * @params  {demical} amount of tokens needed
 * @returns {array} array of saito.slips
 * @returns null if insufficient UTXI
 **/
Wallet.prototype.returnAdequateInputs = function returnAdequateInputs(amt) {

  var utxiset = [];
  var value   = Big(0.0);
  var bigamt  = Big(amt);

  var lowest_block = this.app.blockchain.returnLatestBlockId() - this.app.blockchain.returnGenesisPeriod();

  // +2 is just a safeguard (+1 because is next block, +1 for safeguard)
  lowest_block = lowest_block+2;

  this.purgeExpiredSlips();

  for (let i = 0; i < this.wallet.inputs.length; i++) {
    if (this.wallet.spends[i] == 0 || i >= this.wallet.spends.length) {
      if (this.wallet.inputs[i].lc == 1 && this.wallet.inputs[i].bid >= lowest_block) {
        this.wallet.spends[i] = 1;
        utxiset.push(this.wallet.inputs[i]);
        value = value.plus(Big(this.wallet.inputs[i].amt));
        if (value.gt(bigamt) || value.eq(bigamt)) {
          return utxiset;
        }
      }
    }
  }

  return null;
}



/**
 * calculates the wallet balance and updates the modules
 *
 **/
Wallet.prototype.updateBalance = function updateBalance() {
  this.wallet.balance = this.calculateBalance();
  this.app.modules.updateBalance();
}


/**
 * Goes through our list of input slips and calculates the total
 * value of the spendable SAITO slips stored in this wallet.
 *
 * @returns {string} balance_of_wallet
 **/
Wallet.prototype.calculateBalance = function calculateBalance() {
  let b = Big(0.0);
  let minid = this.app.blockchain.returnLatestBlockId() - this.app.blockchain.returnGenesisPeriod() + 1;
  for (let x = 0; x < this.wallet.inputs.length; x++) {
    let s = this.wallet.inputs[x];
    if (s.lc == 1 && s.bid >= minid) {
      b = b.plus(Big(s.amt));
    }
  }
  return b.toFixed(8);
}



/**
 * Returns wallet balance
 * @returns {string} publickey (hex)
 */
Wallet.prototype.returnBalance = function returnBalance() {
  return this.wallet.balance;
}

/**
 * Returns default fee
 * @returns {decimal} default_fee
 */
Wallet.prototype.returnDefaultFee = function returnDefaultFee() {
  return this.wallet.default_fee;
}

/**
 * saves wallet to options file
 * @returns {string} publickey (hex)
 */
Wallet.prototype.saveWallet = function saveWallet() {
  this.app.options.wallet = this.wallet;
  this.app.storage.saveOptions();
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
 * return the default identifier associated with a wallet, if exists.
**/
Wallet.prototype.returnIdentifier = function returnIdentifier() {
  return this.wallet.identifier;
}


/**
 * Purges all expired slips from the wallet
 */
Wallet.prototype.purgeExpiredSlips = function purgeExpiredSlips() {

  let gid = this.app.blockchain.returnGenesisBlockId();
  for (let m = this.wallet.inputs.length-1; m >= 0; m--) {
    if (this.wallet.inputs[m].bid < gid) {
      this.wallet.inputs.splice(m, 1);
      this.wallet.spends.splice(m, 1);
    }
  }
  for (let m = this.wallet.outputs.length-1; m >= 0; m--) {
    if (this.wallet.outputs[m].bid < gid) {
      this.wallet.outputs.splice(m, 1);
    }
  }
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
// TODO: - can we make these more efficient by referencing our hashmaps
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
    this.purgeExpiredSlips();
    this.resetSpentInputs();
    this.resetExistingSlips(block_id, lc);
  }
}


Wallet.prototype.resetExistingSlips = function resetExistingSlips(block_id, lc=0) {

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


Wallet.prototype.resetSpentInputs = function resetSpentInputs() {

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
    //if (this.wallet.spends[i] == [];
      this.wallet.spends[i] = 0;
    //} else {
    //  i = this.wallet.inputs.length+2;
    //}
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
  this.wallet.spends.splice(pos, 0, 0);

  let hmi = x.returnIndex(x);
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
  if (to_slips.length > 0) {
    for (let m = 0; m < to_slips.length; m++) {

      if (to_slips[m].amt > 0) {

        //
        // Slip(add="", amt="0", type=0, bid=0, tid=0, sid=0, bhash="", lc=1, rn=-1) {
        //
        // TODO: this seems to repeat work done in the saveBlock class now, where we
        // have to provide this information prior to indexing slips. We should clean
        // this up at some point in the future to avoid wasting the work of setting
        // this information twice.
        //
        var s = new saito.slip(
          to_slips[m].add,
          to_slips[m].amt,
          to_slips[m].type,
          blk.block.id,
          tx.transaction.id,
          to_slips[m].sid,
          blk.returnHash(),
          lc,
          to_slips[m].rn
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
  if (from_slips.length > 0) {
    for (var m = 0; m < from_slips.length; m++) {

      var s = from_slips[m];

      //
      // TODO: optimize search based on BID
      //
      for (var c = 0; c < this.wallet.inputs.length; c++) {
        var qs = this.wallet.inputs[c];
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
          this.wallet.spends.splice(c, 1);
          c = this.wallet.inputs.length+2;
        }
      }
    }
  }
}

