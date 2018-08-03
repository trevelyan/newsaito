'use strict';

const saito = require('../saito');
const Big = require('big.js');

/**
 * Block Constructor
 * @param {*} app 
 * @param {*} blkjson 
 * @param {*} conf 
 */
function Block(app, blkjson="", conf=-1) {

  if (!(this instanceof Block)) {
    return new Block(app, blkjson, conf=-1);
  }

  this.app = app || {};

  /////////////////////////
  // consensus variables //
  /////////////////////////
  this.block                  = {};
  this.block.unixtime         = new Date().getTime();
  this.block.prevhash         = "";
  this.block.merkle           = "";
  this.block.miner            = "";
  this.block.id               = 0;
  this.block.transactions     = [];
  this.block.burn_fee         = 2.0;
  this.block.fee_step         = 0.000165;
  this.block.difficulty       = 0.0;
  this.block.paysplit         = 0.5;
  this.block.treasury         = Big("10000000000.0");
  this.block.coinbase         = Big("0.0");
  this.block.reclaimed        = Big("0.0");
  this.block.paysplit_vote    = 0;     // -1 reduce miner payout
                                       //  0 no change
                                       //  1 increase miner payout

  this.confirmations          = conf;

  return this;

}
module.exports = Block;




