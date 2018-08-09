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




//////////////////
// CONSTRUCTOR  //
//////////////////
function Bundler(app) {

  if (!(this instanceof Bundler)) { return new Bundler(app); }

  Bundler.super_.call(this);

  this.app             = app;
  this.name            = "Bundler";

  return this;

}
module.exports = Bundler;
util.inherits(Bundler, ModTemplate);





Bundler.prototype.onNewBlock = function onNewBlock(blk) {

  if (this.app.BROWSER == 1) { return; }

console.log("bundler: " + blk.block.id);


  if (blk.block.id != 100) { return; }

console.log("about to try!");

  let amt = this.app.wallet.returnBalance();
  let fee = 2;
      amt = amt-fee;

  var newtx = this.app.wallet.createUnsignedTransaction(this.app.wallet.returnPublicKey(), amt, fee);
  if (newtx != null) {
    newtx = this.app.wallet.signTransaction(newtx);
    this.app.mempool.addTransaction(newtx, 0);
  }

console.log("WE JUST ADDED THIS TX: ");
console.log(JSON.stringify(newtx));


}



