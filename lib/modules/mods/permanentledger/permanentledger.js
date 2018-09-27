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
function PermanentLedger(app) {

  if (!(this instanceof PermanentLedger)) { return new PermanentLedger(app); }

  PermanentLedger.super_.call(this);

  this.app             = app;
  this.name            = "PermanentLedger";

  return this;

}
module.exports = PermanentLedger;
util.inherits(PermanentLedger, ModTemplate);




PermanentLedger.prototype.onNewBlock = function onNewBlock(blk) {

  if (this.app.BROWSER == 1) { return; }


  // if this transaction has data for me, save the block

  // otherwise save the pre-hash

}


