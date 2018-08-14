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
  this.index = {
    hash:        [],                 // hashes
    prevhash:    [],                 // hash of previous block
    block_id:    [],                 // block id
    mintid:      [],                 // min tid
    maxtid:      [],                 // max tid
    ts:          [],                 // timestamps
    lc:          [],                 // is longest chain (0 = no, 1 = yes)
    bf:          []                 // burnfee per block
  };
  this.blocks              = [];
  this.block_hash_hmap     = [];

  this.genesis_period      = 20160;
  this.indexing_active     = false;

  this.lc_pos_newblock     = null;
  this.lc_pos_prevblock    = null;

  return this;

}
module.exports = Blockchain;


/**
 * Returns the latest block on the longest chain
 * @returns {saito.block} latest_block
 */
//
// this needs to be fixed
// longest chain is not necessarily the last one
//
Blockchain.prototype.returnPreviousBlock = function returnPreviousBlock(lc=1) {
  if (this.blocks.length == 0) { return null; }
  if (lc == 1) {
    return this.blocks[this.lc_pos];
  } else {
    return this.blocks[this.blocks.length-1];
  }
}



/**
 * loads blocks from disk if they exist, and handles
 * lite-client initialization functions.
 **/
Blockchain.prototype.initialize = function initialize() {
  //this.app.storage.loadBlocksFromDisk(this.genesis_period+this.fork_guard);
}






/**
 * Adds block to blockchain
 */
Blockchain.prototype.addBlockToBlockchain = function addBlockToBlockchain(newblock=null) {

  this.indexing_active = true;

  //
  // sanity check
  //
  if (newblock == null || newblock.is_valid == false) {
    this.app.logger.logError("BLOCK IS INVALID",{message:"",err:""});
    this.indexing_active = false;
    return;
  }

  //
  // if our block isnt null
  //
  let hash                   = newblock.returnHash('hex');
  let ts                     = newblock.block.ts;
  let prevhash               = newblock.block.prevhash;
  let bid                    = newblock.block.id;
  let i_am_the_longest_chain = 0;

  console.log(`START TIME: adding ${bid} -> ${hash} ${ts}`);

  //
  // genesis_ts does not yet exist
  //
  // this is stored by lite-clients, and it gets set when they
  // stary up. So what we are doing is checking to see if the
  // block is BEFORE the block that we care about. And how we
  // decide this.genesis_ts is a good question. Normally it is
  // stored in options.conf
  //
  //  if (ts < this.genesis_ts) {
  //    this.indexing_active = false;
  //    return;
  //  }
  //
  if (this.isHashIndexed(hash)) {
    this.indexing_active = false;
    return;
  }


  ////////////////////
  // missing blocks //
  ////////////////////



  /////////////////////////
  // add values to index //
  /////////////////////////
  var pos = 0;
  if (newblock == null) { this.binaryInsert(this.index.ts, ts, (a,b) => { return a - b; }); }
  this.index.hash.splice(pos, 0, hash);
  this.index.prevhash.splice(pos, 0, prevhash);
  this.index.block_id.splice(pos, 0, bid);
  this.index.maxtid.splice(pos, 0, newblock.returnMaxTxId());
  this.index.mintid.splice(pos, 0, newblock.returnMinTxId());
  this.index.lc.splice(pos, 0, i_am_the_longest_chain);
  this.index.bf.splice(pos, 0, newblock.returnBurnFeeValue());
  this.blocks.splice(pos, 0, newblock);

  this.block_hash_hmap[hash] = bid;


  ///////////////////
  // set index pos //
  ///////////////////
  //
  // if the block fails to add successfully, we need to revert
  // to our previous lc index, which is why we save the prevblock
  // version of the longest-chain.
  //
  this.lc_pos_prevblock = this.lc_pos_newblock;
  this.lc_pos_newblock  = pos;













  //
  // we are the longest chain !!!
  //
  this.index.lc[pos] = 1;
  this.lc_pos = pos;


  //
  // start mining
  //
  this.app.miner.stopMining();
  this.app.miner.startMining(newblock);

  this.indexing_active = false;

}


/**
 * Checks if the hash has previosly been indexed
 * @param {*} hash
 */
Blockchain.prototype.isHashIndexed = function isHashIndexed(hash) {
  if (this.block_hash_hmap[hash] > 0) { return true; }
  return false;
};

/**
 * Binary Insert algorithm
 * @param {*} list
 * @param {*} item
 * @param {*} compare
 * @param {*} search
 */
Blockchain.prototype.binaryInsert = function binaryInsert(list, item, compare, search) {

  var start = 0;
  var end = list.length;

  while (start < end) {

    var pos = (start + end) >> 1;
    var cmp = compare(item, list[pos]);

    if (cmp === 0) {
      start = pos;
      end = pos;
      break;
    } else if (cmp < 0) {
      end = pos;
    } else {
      start = pos + 1;
    }
  }

  if (!search) { list.splice(start, 0, item); }

  return start;
}

/**
 * Returns indexed min tx id
 * @returns {int} mintxid
 */
Blockchain.prototype.returnMinTxId = function returnMinTxId() {
  if (this.lc_pos == null) { return 0; }
  return this.index.mintid[this.lc_pos];
}


/**
 * Returns indexed max tx id
 * @returns {int} maxtxid
 */
Blockchain.prototype.returnMaxTxId = function returnMaxTxId() {
  if (this.lc_pos == null) { return 0; }
  return this.index.maxtid[this.lc_pos];
}
