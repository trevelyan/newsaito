const Big = require('big.js');
const saito    = require('../saito');


/**
 * Transaction Constructor
 * @param {*} txjson
 */
function Transaction(txjson="") {

  if (!(this instanceof Transaction)) {
    return new Transaction(txjson);
  }

  /////////////////////////
  // consensus variables //
  /////////////////////////
  this.transaction               = {};
  this.transaction.id            = 1;
  this.transaction.from          = [];
  this.transaction.to            = [];
  this.transaction.ts            = "";
  this.transaction.sig           = "";  // sig of tx
  this.transaction.msig          = "";  // sig of msg
  this.transaction.ver           = 1.0;
  this.transaction.path          = [];
  this.transaction.type          = 0; // 0 = normal
                                      // 1 = golden ticket
                                      // 2 = fee transaction
                                      // 3 = rebroadcasting
  this.transaction.msg           = {};
  this.transaction.ps            = 0;


  this.fees_total                = "";
  this.fees_usable               = "";
  this.fees_publickey            = "";

  this.is_valid                  = true;


  if (txjson != "") {
    try {
      this.transaction = JSON.parse(txjson.toString("utf8")).transaction;
      if (this.transaction.from == null) { this.transaction.from = []; }
      if (this.transaction.to == null)   { this.transaction.to = []; }
      for (var txi = 0; txi < this.transaction.from.length; txi++) {
        this.transaction.from[txi] = new saito.slip(
          this.transaction.from[txi].add,
          this.transaction.from[txi].amt,
          this.transaction.from[txi].type,
          this.transaction.from[txi].bid,
          this.transaction.from[txi].tid,
          this.transaction.from[txi].sid,
          this.transaction.from[txi].bhash,
          this.transaction.from[txi].lc,
          this.transaction.from[txi].rn
        );
      }
      for (var txi = 0; txi < this.transaction.to.length; txi++) {
        this.transaction.to[txi] = new saito.slip(
          this.transaction.to[txi].add,
          this.transaction.to[txi].amt,
          this.transaction.to[txi].type,
          this.transaction.to[txi].bid,
          this.transaction.to[txi].tid,
          this.transaction.to[txi].sid,
          this.transaction.to[txi].bhash,
          this.transaction.to[txi].lc,
          this.transaction.to[txi].rn
        );
      }
    } catch (err) {
      console.log(err);
      this.is_valid = false;
    }
  }

  return this;

}
module.exports = Transaction;


/**
 * Checks if any from fields in the slips contains a publickey and returns a boolean
 * @param {string} senderPublicKey
 * @return {boolean} does the publickey exist in from?
 */
Transaction.prototype.isFrom = function isFrom(senderPublicKey) {
  if (this.returnSlipsFrom(senderPublicKey).length != 0) { return true; }
  return false;
}


/**
 * Checks if any from fields in the slips contains a publickey and returns a boolean
 *
 * @return {boolean} is this transaction a golden ticket solution?
 */
Transaction.prototype.isGoldenTicket = function isGoldenTicket() {
  if (this.transaction.type == 1) { return 1; }
  return false;
}

/**
 * Checks if any to fields in the slips contains a publickey and returns a boolean
 * @param {string} senderPublicKey
 * @return {boolean} does the publickey exist in to?
 */
Transaction.prototype.isTo = function isTo(receiverPublicKey) {
  if (this.returnSlipsTo(receiverPublicKey).length != 0) { return true; }
  return false;
}

/**
 * Returns slips with publickey in from fields
 * @param {string} fromAddress
 * @return {saito.slips} slips_from
 */
Transaction.prototype.returnSlipsFrom = function returnSlipsFrom(fromAddress) {
  var x = [];
  if (this.transaction.from != null) {
    for (var v = 0; v < this.transaction.from.length; v++) {
      if (this.transaction.from[v].add == fromAddress) { x.push(this.transaction.from[v]); }
    }
  }
  return x;
}



/**
 * Returns slips with publickey in from and to fields
 * @param {string} fromAddress
 * @return {saito.slips} object with two arrays => slips_to, slips_from
 */
Transaction.prototype.returnSlipsToAndFrom = function returnSlipsToAndFrom(theAddress) {
  var x = {};
  x.from = [];
  x.to = [];
  if (this.transaction.from != null) {
    for (var v = 0; v < this.transaction.from.length; v++) {
      if (this.transaction.from[v].add == theAddress) { x.from.push(this.transaction.from[v]); }
    }
  }
  if (this.transaction.to != null) {
    for (var v = 0; v < this.transaction.to.length; v++) {
      if (this.transaction.to[v].add == theAddress) { x.to.push(this.transaction.to[v]); }
    }
  }
  return x;
}

/**
 * Returns slips with piblickey in to fields
 * @param {string} toAddress
 * @return {saito.slips} slips_to
 */
Transaction.prototype.returnSlipsTo = function returnSlipsTo(toAddress) {
  var x = [];
  if (this.transaction.to != null) {
    for (var v = 0; v < this.transaction.to.length; v++) {
      if (this.transaction.to[v].add == toAddress) { x.push(this.transaction.to[v]); }
    }
  }
  return x;
}


/**
 * Returns the source text signed to create this.transaction.msig
 */
Transaction.prototype.returnMessageSignatureSource = function returnMessageSignatureSource() {
  return JSON.stringify(this.transaction.msg);
}


/**
 * Returns the source text signed to create this.transaction.sig
 */
Transaction.prototype.returnSignatureSource = function returnSignatureSource() {
  return JSON.stringify(this.transaction.from)
         + JSON.stringify(this.transaction.to)
         + this.transaction.ts
         + this.transaction.ps
         + this.transaction.type
         + JSON.stringify(this.transaction.msig)
}


/**
 * Returns transaction data
 * @returns {saito.transaction} tx
 */
Transaction.prototype.returnTransaction = function returnTransaction() {
  return this.transaction;
}


/**
 * Returns total fees
 * @param {app} application
 * @param {string} creator publickey
 * @returns {string} usable transaction fees
 */
Transaction.prototype.returnFeesTotal = function returnFeesTotal(app, publickey="") {
  if (this.fees_publickey != publickey || this.fees_total == "") { this.calculateFees(app, publickey); }
  return this.fees_total;
}

/**
 * Returns usable fees
 * @param {app} application
 * @param {string} creator publickey
 * @returns {string} usable transaction fees
 */
Transaction.prototype.returnFeesUsable = function returnFeesUsable(app, publickey="") {
  if (this.fees_publickey != publickey || this.fees_usable == "") { this.calculateFees(app, publickey); }
  return this.fees_usable;
}
/**
 * calculates the usable and total transaction fees available from the
 * perspective of the creator publickey (provided as the second argument)
 * @param {app} application
 * @param {string} creator publickey
 */
Transaction.prototype.calculateFees = function calculateFees(app, publickey="") {

  //
  // keep track of which key these were calculated against
  // so that we can refresh the figures if a different key
  // is submitted in the future, and do not just return
  // the wrong figure out of habit.
  //
  this.fees_publickey == publickey;

  //
  // publickey should be block creator, or default to me
  //
  if (publickey == "") {
    publickey = this.app.wallet.returnPublicKey();
  }

  //
  // calculate total fees
  //
  var inputs = Big(0.0);
  if (this.transaction.from != null) {
    for (var v = 0; v < this.transaction.from.length; v++) {
      //if (this.transaction.from[0].type == 0) {
        inputs = inputs.plus(Big(this.transaction.from[v].amt));
      //}
    }
  }

  var outputs = Big(0.0);
  for (var v = 0; v < this.transaction.to.length; v++) {
    // only count outputs on non-gt transactions
    if (this.transaction.to[v].type == 0) {
      outputs = outputs.plus(Big(this.transaction.to[v].amt));
    }
  }

  let tx_fees = inputs.minus(outputs);
  this.fees_total = tx_fees.toFixed(8);


  //
  // calculate usable fees
  //
  if (this.transaction.path.length == 0) {
    // only valid if creator is originator
    if (publickey != this.transaction.from[0].add) {
      this.fees_usable = "0";
      return;
    }
  } else {
    // check publickey is last recipient
    if (publickey != "") {
      if (this.transaction.path[this.transaction.path.length-1].to != publickey) {
        this.fees_usable = "0";
        return;
      }
    }
  }

  //
  // check path integrity
  //
  let from_node = this.transaction.from[0].add;

  for (let i = 0; i < this.transaction.path.length; i++) {

    if (this.transaction.path[i].from != from_node) {
      // path invalid
      this.fees_usable = "0";
      return;
    }

    let msg_to_check = this.transaction.path[i].to;
    let sig_to_check = this.transaction.path[i].sig;

    if (!app.crypto.verifyMessage(msg_to_check, sig_to_check, from_node)) {
      // path invalid
      console.log("ERROR: transaction has invalid path signatures");
      this.fees_usable = "0";
      return;
    }

    from_node = this.transaction.path[i].to;
  }


  //
  // adjust usable fee for pathlength
  //
  var pathlength = this.returnPathLength();
  for (var x = 1; x < pathlength; x++) {
    tx_fees = tx_fees.div(2);
  }

  this.fees_usable = tx_fees.toFixed(8);
  return;

}


Transaction.prototype.returnPathLength = function returnPathLength() {
  return this.transaction.path.length;
}
Transaction.prototype.returnSender = function returnSender() {
  if (this.transaction.from.length >= 1) {
    return this.transaction.from[0].add;
  }
}


/**
 * validate that a transaction is valid given the consensus rules
 * of the blockchain. Note that this function can be called in two
 * different contents:
 *
 * 1. when adding transaction to mempool
 * 2. when confirming block is valid
 *
 * In the first case, we expect the block provided to the function
 * to be null. In the latter case, we expect to have the actual
 * block.
 *
 * @returns {boolean} true_if_validates
 **/
Transaction.prototype.validate = function validate(app, blk=null) {

  //
  // set defaults
  //
  let block_id = app.blockchain.returnLatestBlockId();
  let block_paysplit_vote = 0;
  let avg_fee = 2;


  if (blk != null) { block_id = blk.block.id; }


  ////////////////////////////
  // confirm inputs unspent //
  ////////////////////////////
  if (!app.storage.validateTransactionInputs(this.transaction.from, app.blockchain.returnLatestBlockId())) {
    console.log("Transaction Invalid: checking inputs in validate function");
    return false;
  }

  /////////////////////////////////
  // min one sender and receiver //
  /////////////////////////////////
  if (this.transaction.from.length < 1) {
    console.log("no from address in transaction");
    return false;
  }
  if (this.transaction.to.length < 1) {
    console.log("no to address in transaction");
    return false;
  }



  //////////////////////////
  // no negative payments //
  //////////////////////////
  for (let i = 0; i < this.transaction.from.length; i++) {
    if (Big(this.transaction.from[i].amt).lt(0)) { return 0; }
  }
  for (let i = 0; i < this.transaction.to.length; i++) {
    if (Big(this.transaction.to[i].amt).lt(0)) { return 0; }
  }


  ///////////////////////////
  // validate tx signature //
  ///////////////////////////
  if (!app.crypto.verifyMessage(this.returnSignatureSource(), this.transaction.sig, this.returnSender())) {

    //
    // maybe this is a rebroadcast tx
    //
    // if it is it will not validate, so we have to check to see if we can
    // make it validate through our rebroadcasting rules.
    //

    console.log("transaction invalid: signature does not verify");
    return false;

  }

  ////////////////////////////
  // validate msg signature //
  ////////////////////////////
  if (!app.crypto.verifyMessage(this.returnMessageSignatureSource(),this.transaction.msig,this.returnSender())) {

    //
    // if this fails it may be a rebroadcast tx
    //
    // maybe this is a rebroadcast tx
    //
    console.log("transaction message signature does not verify");
    return false;
  }

  //
  // NOTE
  //
  // at this point we have done all of the validation that would happen
  // if we were provided a transaction without a block. From this point
  // on our checks are for things that require consistency between the
  // transaction and the block / blockchain containing it.
  //
  if (blk == null) { return 0; }

  //
  // update variables
  //
  block_paysplit_vote = blk.block.vote;
  block_id = blk.block.id;
  avg_fee = 2;


  ////////////////////
  // validate votes //
  ////////////////////
  if (block_paysplit_vote == 1) {
    if (this.transaction.ps != 1 && this.transaction.type == 0) {
      console.log("transaction paysplit vote differs from block paysplit vote");
      return false;
    }
  }
  if (block_paysplit_vote == -1) {
    if (this.transaction.ps != -1 && this.transaction.type == 0) {
      console.log("transaction paysplit vote differs from block paysplit vote");
      app.mempool.removeTransaction(this);
      return false;
    }
  }


  ///////////////////////////
  // within genesis period //
  ///////////////////////////
  let acceptable_lower_block_limit = block_id - app.blockchain.returnGenesisPeriod();
  for (let tidx = 0; tidx < this.transaction.from.length; tidx++) {
    if (this.transaction.from[tidx].bid < acceptable_lower_block_limit && this.transaction.type == 0) {
      if (Big(this.transaction.from[tidx].amt).gt(0)) {
        console.log("transaction outdated: tries to spend input from block "+this.transaction.from[tidx].bid);
        console.log(this.transaction.from[tidx]);
        app.mempool.removeTransaction(this);
        return false;
      }
    }
  }

  return true;

}
/**
 * Returns true if we should rebroadcast this tx according to the
 * consensus criteria.
 *
 * @returns {boolean} should we automatically rebroadcast?
 **/
Transaction.prototype.isAutomaticallyRebroadcast = function isAutomaticallyRebroadcast() {
  // fee-capture and golden tickets never rebroadcast
  if (this.transaction.type == 1) { return false; }
  if (this.transaction.type == 2) { return false; }

  // otherwise check value
  return false;

}



