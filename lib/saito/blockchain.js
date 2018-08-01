//
// we do not 'use strict' in this class because
// we need to delete items from our hashmaps when
// purging blocks.
//
const saito    = require('../saito');
const Big      = require('big.js');

/////////////////
// Constructor //
/////////////////
function Blockchain(app) {

  if (!(this instanceof Blockchain)) { return new Blockchain(app); }

  this.app      = app || {};

  this.blocks   = [];

  return this;

}
module.exports = Blockchain;

Blockchain.prototype.returnLatestBlock = function returnLatestBlock() {
  if (this.blocks.length == 0) {
    return new saito.block(this.app);
  } else {
    return this.blocks[this.blocks.length - 1]
  }
}





