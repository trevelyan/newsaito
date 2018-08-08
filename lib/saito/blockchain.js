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

  this.app                 = app || {};
  this.genesis_period      = 12160;
  this.indexing_active     = false;

  return this;

}
module.exports = Blockchain;


/**
 * Returns the latest block on the longest chain
 * @returns {saito.block} latest_block
 */
Blockchain.prototype.returnPreviousBlock = function returnPreviousBlock() {
  return this.app.mempool.blocks[this.app.mempool.blocks.length - 1];
}

Blockchain.prototype.addBlockToBlockchain = function addBlockToBlockchain() {

  this.indexing_active == true;

  //
  // sanity check
  //
  if (newblock == null || newblock.is_valid == false) {
    this.app.logger.logError("BLOCK IS INVALID",{message:"",err:""});
    this.indexing_active = false;
    return;
  }

  let hash                  = newblock.returnHash('hex');
  let ts                    = newblock.block.unixtime;
  let prevhash              = newblock.block.prevhash;
  let bid                   = newblock.block.id;
  let old_lc                = this.longestChain;
  let lc                    = 0; // set longest chain to 0 until we know it is longest chain


  this.app.logger.logInfo(`START TIME: adding ${bid} -> ${hash} ${ts}`)

//
// genesis_ts does not yet exist
//
//  if (ts < this.genesis_ts) {
//    this.indexing_active = false;
//    return;
//  }
//

  if (this.isHashIndexed(hash) == 1) {
    this.indexing_active = false;
    return;
  }

  var pos = this.binaryInsert(this.index.ts, ts, function(a,b) { return a -b;});
  this.index.hash.splice(pos, 0, hash);
  this.index.prevhash.splice(pos, 0, prevhash);
  this.index.block_id.splice(pos, 0, bid);
  this.index.maxtid.splice(pos, 0, newblock.returnMaxTxId());
  this.index.mintid.splice(pos, 0, newblock.returnMinTxId());
  this.index.lc.splice(pos, 0, lc);
  this.index.burnfee.splice(pos, 0, newblock.returnBurnFee());
  this.index.feestep.splice(pos, 0, newblock.returnFeeStep());
  this.block_hashmap[hash] = bid;
  this.blocks.splice(pos, 0, newblock);


  //
  // manually update to longest chain
  //
  this.index.lc[pos] = 1;


  //
  // start mining
  //
  this.app.miner.stopMining();
  this.app.miner.startMining(newblock);


  this.indexing_active = false;

}



Blockchain.prototype.isHashIndexed = function isHashIndexed(hash) {
  if (this.block_hashmap[hash] > 0) { return 1; }
  return -1;
};


