
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
  this.transaction.sig           = "";
  this.transaction.ver           = 1.0;
  this.transaction.path          = [];
  this.transaction.type          = 0;	// 0 = normal
					// 1 = golden ticket
					// 2 = fee transaction
					// 3 = rebroadcasting
  this.transaction.msg           = {};
  this.transaction.msig          = "";
  this.transaction.ps            = 0;


  this.fees_total                = "";
  this.fees_usable               = "";
  this.fees_publickey            = "";

  return this;

}
module.exports = Transaction;




/**
 * Returns total fees
 * @params {app} application
 * @params {string} creator publickey
 * @returns {string} usable transaction fees
 */
Transaction.prototype.returnFeesTotal = function returnFeesTotal(app, publickey="") {
  if (this.fees_publickey != publickey || this.fees_total == "") { this.calculateFees(app, publickey); }
  return this.fees_total;
}
/**
 * Returns usable fees
 * @params {app} application
 * @params {string} creator publickey
 * @returns {string} usable transaction fees
 */
Transaction.prototype.returnFeesUsable = function returnFeesUsable(app, publickey="") {
  if (this.fees_publickey != publickey || this.fees_usable == "") { this.calculateFees(app, publickey); }
  return this.fees_usable;
}
/**
 * calculates the usable and total transaction fees available from the 
 * perspective of the creator publickey (provided as the second argument)
 * @params {app} application
 * @params {string} creator publickey
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



