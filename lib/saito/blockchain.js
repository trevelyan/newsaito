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
  if (newblock == null || newblock.is_valid == 0) {
    this.app.logger.logError("BLOCK IS INVALID",{message:"",err:""});

    this.indexing_active = false;
    return;
  }

  let hash                  = newblock.returnHash('hex');
  let ts                    = newblock.block.unixtime;
  let prevhash              = newblock.block.prevhash;
  let block_id              = newblock.block.id;
  // let old_longestChain      = this.longestChain;
  // this.old_lc               = this.longestChain;


  //
  // we can delete this, just using it to get a sense
  // of how long various parts of block processing take
  // for optimization purposes
  //
  var startTime = new Date().getTime();
  this.app.logger.logInfo(`START TIME: ${startTime}`);
  this.app.logger.logInfo(`Adding block ${block_id} -> ${hash} ${ts}`)

  if (ts < this.genesis_ts) {
    this.indexing_active = false;
    return;
  }
  if (this.isHashIndexed(hash) == 1) {
    this.indexing_active = false;
    return;
  }

  var pos = this.binaryInsert(this.index.ts, ts, function(a,b) { return a -b;});
  this.index.hash.splice(pos, 0, hash);
  this.index.prevhash.splice(pos, 0, prevhash);
  this.index.block_id.splice(pos, 0, block_id);
  this.index.maxtid.splice(pos, 0, newblock.returnMaxTxId());
  this.index.mintid.splice(pos, 0, newblock.returnMinTxId());
  this.index.lc.splice(pos, 0, 0);              // set longest chain to 0 until we know it is longest chain
  this.index.burnfee.splice(pos, 0, newblock.returnBurnFee());
  this.index.feestep.splice(pos, 0, newblock.returnFeeStep());
  this.block_hashmap[hash] = block_id;
  this.blocks.splice(pos, 0, newblock);

  this.index.lc[pos] = 1;

  // Mining takes place here
  // this.app.miner.stopMining();
  // this.app.miner.startMining(newblock);

  // pt 2
  // save block

  // lc hashmap

  // update wallet

  // run callbacks

  // confirm save

  this.app.mempool.processing_active = false;
  this.indexing_active = false;
}






