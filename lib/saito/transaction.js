const saito    = require('../saito');
const Big      = require('big.js');


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

  return this;

}
module.exports = Transaction;




