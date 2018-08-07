'use strict';

const Big = require('big.js');
const Promise = require('bluebird');

/**
 * Block Constructor
 * @param {*} app
 * @param {string} blkjson
 * @param {int} conf
 */
function Block(app, blkjson="", confirmations=-1) {

  if (!(this instanceof Block)) {
    return new Block(app, blkjson, confirmations=-1);
  }

  this.app = app || {};

  /////////////////////////
  // consensus variables //
  /////////////////////////
  this.block                  = {};
  this.block.ts               = new Date().getTime();
  this.block.prevhash         = "";
  this.block.merkle           = "";
  this.block.creator          = "";
  this.block.id               = 0;
  this.block.txsjson          = [];
  this.block.bf               = {};    // burn fee object
				                              // bf.start  (starting fee)
  this.block.difficulty       = 0.1875;
  this.block.paysplit         = 0.5;
  this.block.treasury         = Big("10000000000.0");
  this.block.coinbase         = Big("0.0");
  this.block.reclaimed        = Big("0.0");
  this.block.vote             = 0;     // paysplit vote
				       // -1 reduce miner payout
                                       //  0 no change
                                       //  1 increase miner payout
  this.currently_reclaiming   = false;
  this.confirmations          = confirmations;

  return this;

}
module.exports = Block;

Block.prototype.returnHash = function returnHash() {
  if (this.hash != "") { return this.hash; }
  this.hash = this.app.crypt.hash( this.returnSignatureSource() );
  return this.hash;
}

Block.prototype.bundle = async function bundle(prevblock) {
  return new Promise((resolve, reject) => {
    if (this.app.monitor.isBlockchainActive()) {
      var { currently_indexing, currently_reclaiming } = this.app.blockchain
      console.log(`block.js -- busy and refusing to create block: ${currently_indexing} / ${currently_reclaiming} / ${this.app.mempool.currently_clearing}`);

      this.app.logger.logInfo(`block.js -- busy and refusing to create block: ${currently_indexing} / ${currently_reclaiming} / ${this.app.mempool.currently_clearing}`)
      reject(false);
    }

    // alphabetize
    // need more optimal sort()
    this.block.txsjson.sort();

    // sequential block IDs
    if (prevblock != null) {
      this.block.id = prevblock.block.id + 1;
    }

    // sequential transaction IDs
    // insert transaction json
    var mtid = 0;
    if (prevblock != null) { mtid = prevblock.returnMaxTxId(); }
    for (let i = 0; i < this.block.txsjson.length; i++) {
      mtid++;
      this.block.txsjson[i].transaction.id = mtid;
      this.block.txsjson[i] = this.block.txsjson[i].returnTransactionJson();
    }

    if (this.block.txsjson.length == 0) {
      this.block.merkle     = "";
    } else {
      this.block.merkle     = this.app.crypt.returnMerkleTree(this.block.txsjson).root;
    }

    if (prevblock != null) {

      this.block.treasury   = Big(prevblock.block.treasury).plus(prevblock.block.reclaimed);
      this.block.coinbase   = Big(this.block.treasury).div(this.app.blockchain.genesis_period).toFixed(8);
      this.block.treasury   = this.block.treasury.minus(Big(this.block.coinbase)).toFixed(8);

      this.block.prevhash   = prevblock.block.returnHash();
      this.block.difficulty = prevblock.block.difficulty;
      this.block.paysplit   = prevblock.block.paysplit;
      this.block.bf         = prevblock.block.bf;
    }

    this.calculateReclaimedFunds()
      .then(({reclaimed, validates}) => {
        this.block.txsjson.sort();

        var mtid = 0;
        if (prevblock != null) { mtid = prevblock.returnMaxTxId(); }
        for (i = 0; i < this.block.txsjson.length; i++) {
          mtid++;
          this.block.txsjson[i].transaction.id = mtid;
        }
        for (var i = 0; i < this.block.txsjson.length; i++) {
          this.block.txsjson[i] = this.block.txsjson[i].returnTransactionJson();
        }
        if (this.block.txsjson.length == 0) {
          this.block.merkle     = "";
        } else {
          this.block.merkle     = this.app.crypt.returnMerkleTree(this.block.txsjson).root;
        }

        ///////////////////////////////////////////
        // lite nodes will not properly set this //
        ///////////////////////////////////////////
        //
        // Big.js number
        //
        this.block.reclaimed = reclaimed;


        resolve(validates);
      })
      .catch( err => console.log(err));

  });
}

Block.prototype.calculateReclaimedFunds = function calculateReclaimedFunds() {
  return new Promise((resolve, reject) => {
    resolve({reclaimed: 0.0, validates: true});
  });
}

Block.prototype.validateTransactions = function validateTransactions(){
  return new Promise((resolve, reject) => {
    // check transactions

    // validate merkleTree

    // validate fees

    ////////////////////////////
    // validate golden ticket //
    ////////////////////////////
    //
    // this is unncessary as we take care of it in the blockchain class
    //
    // when writing longest chain
    //
    //////////////////////////////
    // validate fee transaction //
    //////////////////////////////
    //
    // this is unnecessary as we take care of it in the blockchain class
    //
    // when writing longest chain
    //
    // must be for the surplus value calculated according to creator
    //

    // validate transactions
    resolve(true);
  });
}

Block.prototype.validateReclaimedFunds = async function validateReclaimedFunds() {
      // lite clients exit without validating
  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) {
    resolve(true);
  }

  // full nodes have to check
  try {
    var {reclaimed, validates} = await this.calculateReclaimedFunds()
  } catch (err) {
    this.app.logger.logError(`Error thrown in validateReclaimedFunds`, {message: "", err})
  }

  if (!validates) {
    this.app.logger.logInfo("validation error: failure to rebroadcast required transaction")
  }

  if (Big(this.block.reclaimed).eq(reclaimed)) {
    return true;
  } else {
    return false;
  }

}

/**
 * Validates the incoming block
 * @param {saito.block} blk
 * @returns {boolean} validate
 */
Block.prototype.validate = async function validate() {

  // check if indexed
  if (this.app.blockchain.isHashIndexed(this.returnHash())) {
    this.app.logger.logError(`Hash is already indexed: ${this.returnHash()}`,{message:"",err:""});
    return false;
  }

  let validate_tx = await this.validateTransactions();

  // validate block
  if (!validate_tx) {
    this.app.mempool.removeBlock(blk);
    this.app.logger.logError(`INVALID BLOCK HASH: ${blk.returnHash()}`,{message:"",err:""});
    this.block.txsjson = [];

    this.app.logger.logError(JSON.stringify(blk.block, null, 4),{message:"",err:""});
    return false;
  }


  // validate reclaimed funds
  this.currently_reclaiming = true;

  return await this.validateReclaimedFunds()
}