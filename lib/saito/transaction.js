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
                                      // 4 = VIP rebroadcast
                                      // 5 = floating coinbase / golden chunk
  this.transaction.msg           = {};
  this.transaction.ps            = 0;


  this.fees_total                = "";
  this.fees_usable               = "";
  this.fees_publickey            = "";

  this.dmsg			 = "";
  this.size                      = 0;
  this.is_valid                  = 1;

  //
  // this address is used by the automatic transaction rebroadcasting functions
  // to identify slips that we are going to ALLOW to fall through our collection
  // and rebroadcast criteria. This is how we do things like bleed parts of the 
  // golden chunk.
  //
  // the rebroadcasting limit is the lower limit of SAITO that a transaction must
  // have and then we will rebroadcast it assuming it can pay the necessary fee.
  //
  this.atr_rebroadcasting_limit  = 10;
  this.atr_trapdoor_address      = "00000000000000000000000000000000000000000000";




  if (txjson != "") {
    try {

      let txobj = JSON.parse(txjson.toString("utf8"));

      //
      // both txjson as well as tx.transaction json
      //
      if (txobj.transaction == undefined)      { let t = txobj; txobj={}; txobj.transaction = t; }
      if (txobj.transaction.id != undefined)   { this.transaction.id   = txobj.transaction.id; }
      if (txobj.transaction.ts != undefined)   { this.transaction.ts   = txobj.transaction.ts; }
      if (txobj.transaction.from != undefined) { this.transaction.from = txobj.transaction.from; }
      if (txobj.transaction.to != undefined)   { this.transaction.to   = txobj.transaction.to; }
      if (txobj.transaction.sig != undefined)  { this.transaction.sig  = txobj.transaction.sig; }
      if (txobj.transaction.msig != undefined) { this.transaction.msig = txobj.transaction.msig; }
      if (txobj.transaction.ver != undefined)  { this.transaction.ver  = txobj.transaction.ver; }
      if (txobj.transaction.path != undefined) { this.transaction.path = txobj.transaction.path; }
      if (txobj.transaction.type != undefined) { this.transaction.type = txobj.transaction.type; }
      if (txobj.transaction.msg != undefined)  { this.transaction.msg  = txobj.transaction.msg; }
      if (txobj.transaction.ps != undefined)   { this.transaction.ps   = txobj.transaction.ps; }

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
      this.is_valid = 0;
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
  return 0;
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
 * does this transaction reference this publickey?
**/
Transaction.prototype.involvesPublicKey = function involvesPublicKey(publickey) {
  if (this.returnSlipsToAndFrom(publickey).length > 0) { return 1; }
  return 0;
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
 * Returns slips with publickey in to fields
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
 * decrypt the message
 **/
Transaction.prototype.decryptMessage = function decryptMessage(app) {
  // try-catch avoids errors decrypting non-encrypted content
  try {
    var x = app.keys.decryptMessage(this.transaction.from[0].add, this.transaction.msg);
    this.dmsg = x;
  } catch (e) {}
  return;
}


/**
 * Returns the message attached to the transaction
**/
Transaction.prototype.returnMessage = function returnMessage() {
  if (this.dmsg != "") { return this.dmsg; }
  return this.transaction.msg;
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
Transaction.prototype.returnFees = function returnFees() {
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
    publickey = app.wallet.returnPublicKey();
  }

  //
  // calculate total fees
  //
  var inputs = Big(0.0);
  if (this.transaction.from != null) {
    for (var v = 0; v < this.transaction.from.length; v++) {
      //
      // inputs counted on all tx types
      //
      inputs = inputs.plus(Big(this.transaction.from[v].amt));
    }
  }

  var outputs = Big(0.0);
  for (var v = 0; v < this.transaction.to.length; v++) {
    //
    // only count outputs on non-gt transactions
    //
    if (this.transaction.to[v].type != 1 && this.transaction.to[v].type != 2) {
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

  if (app.BROWSER == 1 || app.SPVMODE == 1) { return; }

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
    if (Big(this.transaction.from[i].amt).lt(0)) { 
      console.log("WE HAVE FOUND A NEGATIVE PAYMENT IN THE FROM AMT");
      return 0; 
    }
  }
  for (let i = 0; i < this.transaction.to.length; i++) {
    if (Big(this.transaction.to[i].amt).lt(0)) { 
      console.log("WE HAVE FOUND A NEGATIVE PAYMENT IN THE TO AMT");
      return 0;
    }
  }


  ///////////////////////////
  // validate tx signature //
  ///////////////////////////
  if (!app.crypto.verifyMessage(this.returnSignatureSource(), this.transaction.sig, this.returnSender())) {

    //
    // maybe this is a rebroadcast tx
    //
    // check if we can make its tx-within-a-tx validate
    //
    if (this.transaction.type >= 3 && this.transaction.type <= 5) {

      if (this.transaction.msg.tx == undefined) {
        console.log("transaction message signature does not verify, and there is no internal rebroadcast tx");
        return false;
      }

      var oldtx = new saito.transaction(this.transaction.msg.tx);

      //
      // fee tickets and golden tickets have special rules
      //
      if (oldtx.transaction.type == 1 || oldtx.transaction.type == 2) {
        for (let vi = 0; vi < oldtx.transaction.to.length; vi++) {
          oldtx.transaction.to[vi].bid = 0;
          oldtx.transaction.to[vi].tid = 0;
          oldtx.transaction.to[vi].sid = vi;
          oldtx.transaction.to[vi].bhash = "";
        }
      } else {

        // all but the first (source of funds) txs will be new for VIP
        // and thus must have bhash reset to nothing
        for (let vi = 0; vi < oldtx.transaction.to.length; vi++) {
          oldtx.transaction.to[vi].bid = 0;
          oldtx.transaction.to[vi].tid = 0;
          oldtx.transaction.to[vi].sid = vi;
          oldtx.transaction.to[vi].bhash = "";
        }

      }

      if (!saito.crypt().verifyMessage(oldtx.returnSignatureSource(), oldtx.transaction.sig, oldtx.returnSender())) {
        console.log("transaction signature in original rebroadcast tx does not verify");
        return 0;
      } else {

console.log("ATR TX Validated: ");
console.log(JSON.stringify(this.transaction));

      }

    } else {
      console.log("transaction message signature does not verify 1");
      app.mempool.removeTransaction(this);
      return 0;
    }
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
    if (this.transaction.rb >= 1 || this.transaction.rb == -1 || this.transaction.rb == -2) {

      var oldtx = new saito.transaction(this.transaction.msg.tx);

      // restore message to original condition
      for (let i = 0; i < oldtx.transaction.to.length; i++) {
        oldtx.transaction.to[i].bid = 0;
        oldtx.transaction.to[i].tid = 0;
        oldtx.transaction.to[i].sid = i;
        oldtx.transaction.to[i].bhash = "";
      }

      if (!saito.crypt().verifyMessage(oldtx.returnMessageSignatureSource(), oldtx.transaction.msig, oldtx.returnSender())) {
        console.log("transaction message signature does not verify 2");
        return 0;
      }

    } else {
      console.log("transaction message signature does not verify 3");
      return 0;
    }
  }


  //
  // NOTE
  //
  // at this point we have done all of the validation that would happen
  // if we were provided a transaction without a block. From this point
  // on our checks are for things that require consistency between the
  // transaction and the block / blockchain containing it.
  //
  // return 1 because there is no block provided, so if we have hit this
  // point the transaction has passed our superficial validation tests
  //
  if (blk == null) { return 1; }

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
Transaction.prototype.isAutomaticallyRebroadcast = function isAutomaticallyRebroadcast(oldblk, newblk, slip_id) {

  //
  // fee-capture and golden tickets never rebroadcast
  //
  // if (this.transaction.type == 1) 				         { return false; }
  // if (this.transaction.type == 2) 				         { return false; }
  //
  if (this.transaction.to.length == 0) 				         { return false; }
  if (this.transaction.to[slip_id].add == this.atr_trapdoor_address)     { return false; }
  if (this.transaction.type == 3) 				         { return true; }
  if (this.transaction.type == 4) 				         { return true; }
  if (this.transaction.type == 5) 				         { return true; }
  if (Big(this.transaction.to[slip_id].amt).gt(this.atr_rebroadcasting_limit)) { return true; }

  return false;

}





/*
 * create a transaction that is valid and that will rebroadcast the relevant tokens
 *
 * the rebroadcast transactions are handled on a slip-by-slip basis. So we will be
 * splitting up a transaction according to its UTXO if needed.
 *
 **/
Transaction.prototype.generateRebroadcastTransaction = function generateRebroadcastTransaction(tid, slip_id, avg_fee=2) {

  if (this.transaction.to.length == 0) { return null; }

  var newtx = new saito.transaction();
  newtx.transaction.sig = this.transaction.sig;
  newtx.transaction.msg = {};

  var fee = Big(avg_fee);
  if (avg_fee == 0) { fee = Big(2); }


  /////////////////////////
  // normal rebroadcasts //
  /////////////////////////
  //
  // TODO
  //
  // we don't want to circulate golden tickets or fee transactions
  // people should be spending them.
  //
  //if (this.transaction.type == 3 || this.transaction.type == 0) {
  if (this.transaction.type >= 0 && this.transaction.type <= 3) {

    newtx.transaction.type = 3;
    if (this.transaction.msg.loop == undefined) {
      newtx.transaction.msg.loop = 1;
    } else {
      newtx.transaction.msg.loop = this.transaction.msg.loop+1;
    }

    for (i = 1; i < newtx.transaction.msg.loop; i++) { fee = fee.times(2); }

    var amt = Big(this.transaction.to[slip_id].amt).minus(fee);
    if (amt.lt(0)) {
      fee = Big(this.transaction.to[slip_id].amt);
      amt = Big(0);
    }

    if (this.transaction.msg.tx != undefined) {
      newtx.transaction.msg.tx = this.transaction.msg.tx;
    } else {
      newtx.transaction.msg.tx = JSON.stringify(this.transaction);
    }

    var from = new saito.slip(this.transaction.to[slip_id].add, this.transaction.to[slip_id].amt, 3);
        from.tid = tid;
        from.sid = slip_id;
    var to   = new saito.slip(this.transaction.to[slip_id].add, amt.toFixed(8), 3);
    var fees = new saito.slip(this.atr_trapdoor_address, fee.toFixed(8));
    fees.sid = 1;

    newtx.transaction.from.push(from);
    newtx.transaction.to.push(to);
    newtx.transaction.to.push(fees);

  }


  ///////////////////////////
  // prestige rebroadcasts //
  ///////////////////////////
  if (this.transaction.type == 4) {

    // protecting early supporters
    newtx.transaction.type = this.transaction.type;

    if (this.transaction.msg.tx != undefined) {
      newtx.transaction.msg.tx = this.transaction.msg.tx;
    } else {
      newtx.transaction.msg.tx = JSON.stringify(this.transaction);
    }

    var from = new saito.slip(this.transaction.to[slip_id].add, this.transaction.to[slip_id].amt, 4);
        from.tid = tid;
        from.sid = slip_id;
    var to   = new saito.slip(this.transaction.to[slip_id].add, this.transaction.to[slip_id].amt, 4);
    newtx.transaction.from.push(from);
    newtx.transaction.to.push(to);

  }



  //////////////////
  // golden chunk //
  //////////////////
  if (this.transaction.type == 5) {

    newtx.transaction.type = this.transaction.type;

    // calculate fee
    //
    // average fee * 10
    //
    var fee = Big(Big(avg_fee).times(10).toFixed(8));

    // minimum of 20
    if (fee.lt(20)) { fee = Big(20); }
    var amt = Big(this.transaction.to[slip_id].amt).minus(fee);
    if (amt.lt(0)) {
      fee = Big(this.transaction.to[slip_id].amt);
      amt = Big(0);
    }

    if (this.transaction.msg.tx != undefined) {
      newtx.transaction.msg.tx = this.transaction.msg.tx;
    } else {
      newtx.transaction.msg.tx = JSON.stringify(this.transaction);
    }

    var from = new saito.slip(this.transaction.to[slip_id].add, this.transaction.to[slip_id].amt, 5);
        from.tid = tid;
        from.sid = slip_id;
    var to   = new saito.slip(this.transaction.to[slip_id].add, amt.toFixed(8), 5);
    var fees = new saito.slip(this.trapdoor, fee.toFixed(8));
    fees.sid = 1;

    newtx.transaction.from.push(from);
    newtx.transaction.to.push(to);
    newtx.transaction.to.push(fees);   // this ensures fee falls into money supply

  }

  return newtx;

}

