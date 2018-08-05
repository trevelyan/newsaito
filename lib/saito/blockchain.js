//
// we do not 'use strict' in this class because
// we need to delete items from our hashmaps when
// purging blocks.
//
const saito    = require('../saito');
const Big      = require('big.js');

/**
 * Blockchain Contructor
 * @param {*} app
 */
function Blockchain(app) {

  if (!(this instanceof Blockchain)) { return new Blockchain(app); }

  this.app      = app || {};

  this.blocks   = [];

  return this;

}
module.exports = Blockchain;

/**
 * Returns the latest block on the chain
 * @returns {block} latest_block
 */
Blockchain.prototype.returnLatestBlock = function returnLatestBlock() {
  if (this.blocks.length == 0) {
    return new saito.block(this.app);
  }
  return this.blocks[this.blocks.length - 1]
}

