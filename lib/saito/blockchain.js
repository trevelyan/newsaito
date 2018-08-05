//
// we cannot 'use strict' as we need to delete items from hashmaps
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
 * Returns the latest block on the longest chain
 * @returns {saito.block} latest_block
 */
Blockchain.prototype.returnPreviousBlock = function returnPreviousBlock() {
  return null;
}



