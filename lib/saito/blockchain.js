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

  this.app     = app || {};

  return this;

}
module.exports = Blockchain;






