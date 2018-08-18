
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
  this.transaction.type          = 0;	// 0 = normal
                                      // 1 = golden ticket
                                      // 2 = fee transaction
                                      // 3 = rebroadcasting
  this.transaction.msg           = {};
  this.transaction.ps            = 0;


  this.fees_total                = "";
  this.fees_usable               = "";
  this.fees_publickey            = "";

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
      inputs = inputs.plus(Big(this.transaction.from[v].amt));
    }
  }

  var outputs = Big(0.0);
  for (var v = 0; v < this.transaction.to.length; v++) {
    // only count outputs on non-gt transactions
    if (this.transaction.to[v].gt != 1) {
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
    tx_fee = tx_fee.div(2);
  }

  this.fees_usable = tx_fee.toFixed(8);
  return;

}



