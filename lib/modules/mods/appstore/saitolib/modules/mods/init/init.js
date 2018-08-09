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
function Init(app) {

  if (!(this instanceof Init)) { return new Init(app); }

  Init.super_.call(this);

  this.app             = app;
  this.name            = "Init";

  return this;

}
module.exports = Init;
util.inherits(Init, ModTemplate);




Init.prototype.onNewBlock = function onNewBlock(blk) {

  if (this.app.BROWSER == 1) { return; }

  if (blk.block.id > 20) { return; } 
  //if (blk.block.id != 10) { 
  if (blk.block.id < 21) { 

    // empty mempool
    this.app.mempool.transactions = [];

    var thisfee = Big(2.0);
    var thisamt = Big(this.app.wallet.returnBalance());
        thisamt = thisamt.minus(thisfee);

    if (thisamt.gt(0)) {

    let newtx = this.app.wallet.createUnsignedTransaction(this.app.wallet.returnPublicKey(), thisamt.toFixed(8), thisfee.toFixed(8));
      if (newtx != null) {
        console.log("------------- CREATING TX ---------------");
        newtx = this.app.wallet.signTransaction(newtx);
        this.app.mempool.addTransaction(newtx, 0); // don't relay-on-validate
      } else {
        console.log("ERROR: spammer modules - newtx is null...");
      }
    }

    return;
  }


/*
  if (blk.block.id == 10) {
 
    let newtx = null;

    //newtx = this.app.wallet.createUnsignedTransaction("xTkfoQ58m5A6gHcQpuKhe3NAgzeoWZCeXx9vb9eVzZJF", 1000, 0);
    newtx = this.app.wallet.createUnsignedTransaction(this.app.wallet.returnPublicKey(), 1000, 0);
    newtx.transaction.rb = -1;
    newtx = this.app.wallet.signTransaction(newtx);
    this.app.mempool.addTransaction(newtx, 0); // don't relay-on-validate

    // Prestige Transaction
    //newtx = this.app.wallet.createUnsignedTransaction("xTkfoQ58m5A6gHcQpuKhe3NAgzeoWZCeXx9vb9eVzZJF", 10000, 0);
    //newtx.transaction.rb = -2;
    //newtx = this.app.wallet.signTransaction(newtx);
    //this.app.mempool.addTransaction(newtx, 0); // don't relay-on-validate
    //
    // and pay a fee to trigger a block
    //newtx = this.app.wallet.createUnsignedTransaction(this.app.wallet.returnPublicKey(), 0, 2);
    //newtx = this.app.wallet.signTransaction(newtx);
    //this.app.mempool.addTransaction(newtx, 0); // don't relay-on-validate

  }
*/

}

