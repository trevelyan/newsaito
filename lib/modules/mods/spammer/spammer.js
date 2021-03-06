//
// This module monitors the blockchain and our
// unspent transaction inputs. It creates fake
// transactions to speed up block production
// for testing purposes.`
//
var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var crypto = require('crypto');
const Big      = require('big.js');



//////////////////
// CONSTRUCTOR  //
//////////////////
function Spammer(app) {

  if (!(this instanceof Spammer)) { return new Spammer(app); }

  Spammer.super_.call(this);

  this.app             = app;
  this.name            = "Spammer";

  return this;

}
module.exports = Spammer;
util.inherits(Spammer, ModTemplate);




Spammer.prototype.onNewBlock = function onNewBlock(blk) {

  if (this.app.BROWSER == 1) { return; }

  //if (blk.block.id > 99) { return; }
  //
  // one possible cause of failure is if we create a large
  // number of transactions and it takes so long that only
  // some of them get added to the next block, and then we
  // have double-input problems.
  //
  // in order to avoid this, we just empty the mempool first
  //this.app.mempool.transactions = [];
  //this.app.mempool.transactions_hmap = [];
  //this.app.mempool.transactions_inputs_hmap = [];


  var emails_to_send = 5;
  var size_of_emails_in_mb = 5.0;
  var size_of_mb = 1024000;

console.log("running spammer...");

  try {
console.log("-----------------------------------------");
    for (let x = 0; x < emails_to_send; x++) {

console.log("producing email: " + x);

      var available_inputs_limit = 0.5;
      var available_inputs       = Big(blk.app.wallet.returnAvailableInputs(available_inputs_limit));

      if (available_inputs.lt(available_inputs_limit) || (x < 0 || x >= emails_to_send)) {
        return;
      }

     var thisfee = Big(1.0); 
     var thisamt = Big(1.0);
     var newtx = null;

      if (emails_to_send == 1) {
        //thisamt = Big(this.app.wallet.returnBalance());
        //thisamt = thisamt.minus(thisfee);
      }

      if (thisamt.gt(0)) {

        //if (blk.block.id < 100) { thisfee = 0.001; }
        //if (blk.block.id < 70) { thisfee = 0.01; }
        //if (blk.block.id < 60) { thisfee = 0.01; }
        //if (blk.block.id < 50) { thisfee = 0.02; }
        //if (blk.block.id < 24) { thisfee = 0.3; }
        //if (blk.block.id < 12) { thisfee = 0.4; }
        //if (blk.block.id < 6) { thisfee = 0.5; }
        //if (blk.block.id < 5) { thisfee = 0.6; }
        //if (blk.block.id < 4) { thisfee = 0.7; }
        //if (blk.block.id < 3) { thisfee = 0.8; }
        //if (blk.block.id < 2) { thisfee = 0.9; }
        //if (x > 3) { thisfee = 0.1; }
        //if (x > 10) { thisfee = 0.01; }
        //if (x > 100) { thisfee = 0.001; }
        //if (x == 2) { thisfee = 0.2; }
        //if (x == 1) { thisfee = 2; }

        newtx = this.app.wallet.createUnsignedTransaction(this.app.wallet.returnPublicKey(), thisamt, thisfee);

        if (newtx != null) {
          if (x == 0) { console.log("------------- CREATING TX ---------------"); }
          var strlength = size_of_mb * size_of_emails_in_mb;
          newtx.transaction.msg.data = crypto.randomBytes(Math.ceil(strlength/2)).toString('hex').slice(0,strlength);
          newtx = this.app.wallet.signTransaction(newtx);

let prems = this.app.mempool.transactions.length;
let prems2 = prems;
          this.app.mempool.addTransaction(newtx, 0); // don't relay-on-validate
if (this.app.mempool.transactions.length != prems+1) {

console.log("THIS TX FAILED: ");
newtx.transaction.msg.data = "";
console.log(JSON.stringify(newtx));

}

        } else {
          console.log("ERROR: spammer modules - newtx is null...");
//console.log("WALLET: ");
//console.log(JSON.stringify(this.app.wallet.wallet));
        }

      }
    }
console.log("running spammer 2 OK... " + this.app.mempool.transactions.length);
console.log("-----------------------------------------");
  } catch(err) {
console.log("running spammer 3 error...");
    console.log(err);
  }

}

