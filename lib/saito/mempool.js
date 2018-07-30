'use strict';

const saito = require('../saito');
const fs = require('fs');
const path = require('path');
const Big = require('big.js');


/////////////////
// Constructor //
/////////////////
function Mempool(app) {

  if (!(this instanceof Mempool)) {
    return new Mempool(app);
  }

  this.app                        = app || {};

  this.directory                  = path.join(__dirname, '../data/');

  this.transactions               = []; // array
  this.downloads                  = []; // queue fifo
  this.blocks                     = []; // queue fifo
  this.recovered                  = []; // array of recovered txs
                                        // used when reorgs affect
                                        // our old blocks

  return this;

}
module.exports = Mempool;




