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
  this.indexing = false;
  this.reclaiming = false;
  this.block_hashmap = [];

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

Blockchain.prototype.isHashIndexed = function isHashIndexed(hash) {
  return this.block_hashmap[hash] > 0
};

/**
 * Validates the incoming block and queues it in mempool
 * @param {saito.block} blk
 * @returns {boolean} validate
 */
Blockchain.prototype.validateBlockAndQueueInMempool = function validateBlockAndQueueInMempool(blk) {

  // check if indexed
  if (this.isHashIndexed( blk.returnHash())) {
    console.log("Hash is already indexed: " + blk.returnHash() );
    this.app.logger.logError(`Hash is already indexed: ${blk.returnHash()}`,{message:"",err:""});
    return false;
  }


  // validate block
  if (! blk.validate() ) {
    console.log("Here")
    this.app.mempool.removeBlock(blk);
    this.app.logger.logError(`INVALID BLOCK HASH: ${blk.returnHash()}`,{message:"",err:""});
    blk.block.txsjson = [];

    this.app.logger.logError(JSON.stringify(blk.block, null, 4),{message:"",err:""});
    return false;
  }


  // validate reclaimed funds
  this.currently_reclaiming = true;

  blk.validateReclaimedFunds()
  .then((validated) => {
    console.log("Do we get here?")
    if (!validated) {
      this.app.logger.logError("Reclaimed Funds found invalid",{message:"",err:""});
      this.app.mempool.removeBlock(blk);
      this.currently_reclaiming = false;
      return false;
    }

    // add to FIFI mempool queue
    if (!this.app.mempool.addBlock(blk)) {
      this.currently_reclaiming = false;
      return false;
    }

    // process
    blockchain_self.currently_reclaiming = false;
  })
  .catch(err => console.log(err));
}

